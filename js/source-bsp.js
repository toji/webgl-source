/*
 * Valve Source Engine level rendering
 */

/*
 * Copyright (c) 2011 Brandon Jones
 *
 * This software is provided 'as-is', without any express or implied
 * warranty. In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 *    1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 *
 *    2. Altered source versions must be plainly marked as such, and must not
 *    be misrepresented as being the original software.
 *
 *    3. This notice may not be removed or altered from any source
 *    distribution.
 */

"use strict";

//=============
// Shaders
//=============

// Vertex Shader
var meshVS = "attribute vec3 position;\n";
meshVS += "attribute vec2 texture;\n";
meshVS += "attribute vec2 light;\n";

meshVS += "uniform mat4 modelViewMat;\n";
meshVS += "uniform mat4 projectionMat;\n";

meshVS += "varying vec2 texCoord;\n";
meshVS += "varying vec2 lightCoord;\n";

meshVS += "void main(void) {\n";
meshVS += " vec4 vPosition = modelViewMat * vec4(position, 1.0);\n";
meshVS += " texCoord = texture;\n";
meshVS += " lightCoord = light;\n";
meshVS += " gl_Position = projectionMat * vPosition;\n";
meshVS += "}";

// Fragment Shader
var meshFS = "uniform sampler2D diffuse;";
meshFS += "uniform sampler2D lightmap;";
meshFS += "varying vec2 texCoord;\n";
meshFS += "varying vec2 lightCoord;\n";
meshFS += "void main(void) {\n";
meshFS += " vec4 light = texture2D(lightmap, lightCoord);\n";
meshFS += " vec4 color = texture2D(diffuse, texCoord);\n";
meshFS += " vec3 ambient = vec3(0.15, 0.15, 0.15);\n"; 
meshFS += " gl_FragColor = vec4(color.rgb * (light.rgb + ambient), color.a);\n";
//meshFS += " gl_FragColor = vec4(light.rgb, 1.0);\n";
//meshFS += " gl_FragColor = color;\n";
meshFS += "}";

//=============
// BSP Struct
//=============

var MAX_INDEX = 65536;
var MAXLIGHTMAPS = 4;
var HEADER_LUMPS = 64;
var STATIC_PROP_NAME_LENGTH = 128;

var GAMELUMP_STATIC_PROPS = 1936749168; // 'sprp';

var LUMP_ENTITIES                   = 0,
    LUMP_PLANES                     = 1,
    LUMP_TEXDATA                    = 2,
    LUMP_VERTEXES                   = 3,
    LUMP_VISIBILITY                 = 4,
    LUMP_NODES                      = 5,
    LUMP_TEXINFO                    = 6,
    LUMP_FACES                      = 7,
    LUMP_LIGHTING                   = 8,
    LUMP_OCCLUSION                  = 9,
    LUMP_LEAFS                      = 10,
    LUMP_FACEIDS                    = 11,
    LUMP_EDGES                      = 12,
    LUMP_SURFEDGES                  = 13,
    LUMP_MODELS                     = 14,
    LUMP_WORLDLIGHTS                = 15,
    LUMP_LEAFFACES                  = 16,
    LUMP_LEAFBRUSHES                = 17,
    LUMP_BRUSHES                    = 18,
    LUMP_BRUSHSIDES                 = 19,
    LUMP_AREAS                      = 20,
    LUMP_AREAPORTALS                = 21,
    LUMP_UNUSED0                    = 22,
    LUMP_UNUSED1                    = 23,
    LUMP_UNUSED2                    = 24,
    LUMP_UNUSED3                    = 25,
    LUMP_DISPINFO                   = 26,
    LUMP_ORIGINALFACES              = 27,
    LUMP_PHYSDISP                   = 28,
    LUMP_PHYSCOLLIDE                = 29,
    LUMP_VERTNORMALS                = 30,
    LUMP_VERTNORMALINDICES          = 31,
    LUMP_DISP_LIGHTMAP_ALPHAS       = 32,
    LUMP_DISP_VERTS                 = 33,
    LUMP_DISP_LIGHTMAP_SAMPLE_POSITIONS = 34,
    LUMP_GAME_LUMP                  = 35,
    LUMP_LEAFWATERDATA              = 36,
    LUMP_PRIMITIVES                 = 37,
    LUMP_PRIMVERTS                  = 38,
    LUMP_PRIMINDICES                = 39,
    LUMP_PAKFILE                    = 40,
    LUMP_CLIPPORTALVERTS            = 41,
    LUMP_CUBEMAPS                   = 42,
    LUMP_TEXDATA_STRING_DATA        = 43,
    LUMP_TEXDATA_STRING_TABLE       = 44,
    LUMP_OVERLAYS                   = 45,
    LUMP_LEAFMINDISTTOWATER         = 46,
    LUMP_FACE_MACRO_TEXTURE_INFO    = 47,
    LUMP_DISP_TRIS                  = 48,
    LUMP_PHYSCOLLIDESURFACE         = 49,
    LUMP_WATEROVERLAYS              = 50,
    LUMP_LEAF_AMBIENT_INDEX_HDR     = 51,
    LUMP_LEAF_AMBIENT_INDEX         = 52,
    LUMP_LIGHTING_HDR               = 53,
    LUMP_WORLDLIGHTS_HDR            = 54,
    LUMP_LEAF_AMBIENT_LIGHTING_HDR  = 55,
    LUMP_LEAF_AMBIENT_LIGHTING      = 56,
    LUMP_XZIPPAKFILE                = 57,
    LUMP_FACES_HDR                  = 58,
    LUMP_MAP_FLAGS                  = 59,
    LUMP_OVERLAY_FADES              = 60;

// TexInfo Flags
var SURF_LIGHT = 0x0001, // value will hold the light strength
    SURF_SKY2D = 0x0002, // don't draw, indicates we should skylight + draw 2d sky but not draw the 3D skybox
    SURF_SKY = 0x0004, // don't draw, but add to skybox
    SURF_WARP = 0x0008, // turbulent water warp
    SURF_TRANS = 0x0010,
    SURF_NOPORTAL = 0x0020, // the surface can not have a portal placed on it
    SURF_TRIGGER = 0x0040, // FIXME: This is an xbox hack to work around elimination of trigger surfaces, which breaks occluders
    SURF_NODRAW = 0x0080, // don't bother referencing the texture
    SURF_HINT = 0x0100, // make a primary bsp splitter
    SURF_SKIP = 0x0200, // completely ignore, allowing non-closed brushes
    SURF_NOLIGHT = 0x0400, // Don't calculate light
    SURF_BUMPLIGHT = 0x0800, // calculate three lightmaps for the surface for bumpmapping
    SURF_NOSHADOWS = 0x1000, // Don't receive shadows
    SURF_NODECALS = 0x2000, // Don't receive decals
    SURF_NOCHOP = 0x4000, // Don't subdivide patches on this surface 
    SURF_HITBOX = 0x8000; // surface is part of a hitbox

var Vector = Struct.create(
    Struct.float32("x"),
    Struct.float32("y"),
    Struct.float32("z")
);

var QAngle = Struct.create(
    Struct.float32("x"),
    Struct.float32("y"),
    Struct.float32("z")
);

var lump_t = Struct.create(
    Struct.int32("fileofs"),
    Struct.int32("filelen"),
    Struct.int32("version"),
    Struct.int32("fourCC")
);

var dheader_t = Struct.create(
    Struct.string("ident", 4),
    Struct.int32("version"),
    Struct.array("lumps", lump_t, HEADER_LUMPS),
    Struct.int32("mapRevision")
);

var dplane_t = Struct.create(
    Struct.struct("normal", Vector),
    Struct.float32("dist"),
    Struct.int32("type")
);

var dedge_t = Struct.create(
    Struct.array("v", Struct.uint16(), 2)
);

var dface_t = Struct.create(
    Struct.uint16("planenum"),
    Struct.int8("side"),
    Struct.int8("onNode"),
    Struct.int32("firstedge"),
    Struct.int16("numedges"),   
    Struct.int16("texinfo"),
    Struct.int16("dispinfo"),
    Struct.int16("surfaceFogVolumeID"),
    Struct.array("styles", Struct.uint8(), MAXLIGHTMAPS),
    Struct.int32("lightofs"),
    Struct.float32("area"),
    Struct.array("m_LightmapTextureMinsInLuxels", Struct.int32(), 2),
    Struct.array("m_LightmapTextureSizeInLuxels", Struct.int32(), 2),
    Struct.int32("origFace"),
    Struct.uint16("m_NumPrims"),
    Struct.uint16("firstPrimID"),
    Struct.uint32("smoothingGroups")
);

var texinfo_vec = Struct.create(
    Struct.float32("x"),
    Struct.float32("y"),
    Struct.float32("z"),
    Struct.float32("offset")
);

var texinfo_t = Struct.create(
    Struct.array("textureVecsTexelsPerWorldUnits", texinfo_vec, 2),
    Struct.array("lightmapVecsLuxelsPerWorldUnits", texinfo_vec, 2),
    Struct.int32("flags"), 
    Struct.int32("texdata")
);

var dtexdata_t = Struct.create(
    Struct.struct("reflectivity", Vector),
    Struct.int32("nameStringTableID"),
    Struct.int32("width"),
    Struct.int32("height"),
    Struct.int32("view_width"), 
    Struct.int32("view_height"),
    {
        faces: {
            value: null
        },
        
        addFace: {
            value: function(face) {
                if(!this.faces) {
                    this.faces = [];
                }
                this.faces.push(face);
            }
        },
        
        numvertex: {
            value: 0
        }
    }
);

var dmodel_t = Struct.create(
    Struct.struct("mins", Vector), Struct.struct("maxs", Vector),
    Struct.struct("origin", Vector),
    Struct.int32("headnode"),
    Struct.int32("firstface"),
    Struct.int32("numfaces")
);

var dnode_t = Struct.create(
    Struct.int32("planenum"),
    Struct.array("children", Struct.int32(), 2),
    Struct.array("mins", Struct.int16(), 3),
    Struct.array("maxs", Struct.int16(), 3),
    Struct.uint16("firstface"),
    Struct.uint16("numfaces"),
    Struct.int16("area"),
    Struct.int16("paddding")
);

var ColorRGBExp32 = Struct.create(
    Struct.uint8("r"), Struct.uint8("g"), Struct.uint8("b"),
    Struct.int8("exponent")
);

var CompressedLightCube = Struct.create(
    Struct.array("m_Color", ColorRGBExp32, 6)
);

var dleaf_t = Struct.create(
    Struct.int32("contents"),
    Struct.int16("cluster"),
    Struct.int8("area"), // Packing issues here, should be 9 bits
    Struct.int8("flags"), // packing issues here, should be 7 bits
    Struct.array("mins", Struct.int16(), 3),
    Struct.array("maxs", Struct.int16(), 3),
    Struct.uint16("firstleafface"),
    Struct.uint16("numleaffaces"),
    Struct.uint16("firstleafbrush"),
    Struct.uint16("numleafbrushes"),
    Struct.int16("leafWaterDataID"),
    Struct.struct("ambientLighting", CompressedLightCube),
    Struct.int16("padding")
);

var dbrush_t = Struct.create(
    Struct.int32("firstside"),
    Struct.int32("numsides"),
    Struct.int32("contents")
);

var dbrushside_t = Struct.create(
    Struct.uint16("planenum"),
    Struct.int16("texinfo"),
    Struct.int16("dispinfo"),
    Struct.int16("bevel")
);

var dgamelumpheader_t = Struct.create(
    Struct.int32("lumpCount")
);

var dgamelump_t = Struct.create(
    Struct.int32("id"),
    Struct.uint16("flags"),
    Struct.uint16("version"),
    Struct.int32("fileofs"),
    Struct.int32("filelen")
);

var StaticPropDictLumpHeader_t = Struct.create(
    Struct.int32("dictEntries")
);

var StaticPropDictLump_t = Struct.create(
    Struct.string("m_Name", STATIC_PROP_NAME_LENGTH)
);

var StaticPropLeafLumpHeader_t = Struct.create(
	Struct.int32("leafEntries")
);

var StaticPropLeafLump_t = Struct.create(
	Struct.uint16("m_Leaf")
);

var StaticPropLumpHeader_t = Struct.create(
    Struct.int32("propEntries")
);

var StaticPropLump_t = Struct.create(
    Struct.struct("m_Origin", Vector),
    Struct.struct("m_Angles", QAngle),
    Struct.uint16("m_PropType"),
    Struct.uint16("m_FirstLeaf"),
    Struct.uint16("m_LeafCount"),
    Struct.uint8("m_Solid"),
    Struct.uint8("m_Flags"),
    Struct.int32("m_Skin"),
    Struct.float32("m_FadeMinDist"),
    Struct.float32("m_FadeMaxDist"),
    Struct.struct("m_LightingOrigin", Vector),
    Struct.float32("m_flForcedFadeScale"),
    Struct.uint16("m_nMinDXLevel"),
    Struct.uint16("m_nMaxDXLevel")
);

var SourceBsp = Object.create(Object, {
    VERTEX_STRIDE: {
        value: 28
    },
    
    VERTEX_ELEMENTS: {
        value: 7
    },
    
    shader: {
        value: null
    },
    
    defaultTexture: {
        value: null
    },
    
    lockGroups: {
        value: null
    },
    
    vertBuffer: {
        value: null
    },
    
    indexBuffer: {
        value: null
    },
    
    load: {
        value: function(gl, url) {
            this._initializeShaders(gl);
            
            var self = this;
            
            var bspXhr = new XMLHttpRequest();
            bspXhr.open('GET', url + ".bsp", true);
            bspXhr.responseType = "arraybuffer";
            bspXhr.addEventListener("load", function() {
                var bspData = self._parseBsp(this.response);
                self._processFaces(gl, bspData);
                self.lockGroups = bspData.lockGroups;
                
                self._loadMaterials(gl, bspData);
                self._compileBuffers(gl, bspData);
            });
            bspXhr.send(null);
            
            this.defaultTexture = glUtil.loadTexture(gl, "root/no-shader.jpg");

            return this;
        }
    },
    
    _parseBsp: {
        value: function(buffer) {
            var header = dheader_t.readStructs(buffer, 0, 1)[0];
            
            var bspData = {
                planes: this._parseLump(buffer, header.lumps[LUMP_PLANES], dplane_t),
                vertices: this._parseLump(buffer, header.lumps[LUMP_VERTEXES], Vector),
                edges: this._parseLump(buffer, header.lumps[LUMP_EDGES], dedge_t),
                faces: this._parseLump(buffer, header.lumps[LUMP_FACES], dface_t),
                texInfo: this._parseLump(buffer, header.lumps[LUMP_TEXINFO], texinfo_t),
                texData: this._parseLump(buffer, header.lumps[LUMP_TEXDATA], dtexdata_t),
                models: this._parseLump(buffer, header.lumps[LUMP_MODELS], dmodel_t),
                nodes: this._parseLump(buffer, header.lumps[LUMP_NODES], dnode_t),
                leafs: this._parseLump(buffer, header.lumps[LUMP_LEAFS], dleaf_t),
                brushes: this._parseLump(buffer, header.lumps[LUMP_BRUSHES], dbrush_t),
                brushSides: this._parseLump(buffer, header.lumps[LUMP_BRUSHSIDES], dbrushside_t),
            };
            
            var leafFaceLump = header.lumps[LUMP_LEAFFACES];
            bspData.leafFaces = new Uint16Array(buffer, leafFaceLump.fileofs, leafFaceLump.filelen/2); // Possible alignment issues here!
            
            var surfEdgeLump = header.lumps[LUMP_SURFEDGES];
            bspData.surfEdges = new Int32Array(buffer, surfEdgeLump.fileofs, surfEdgeLump.filelen/4); // Possible alignment issues here!
            
            var lightingLump = header.lumps[LUMP_LIGHTING];
            bspData.lighting = new Uint8Array(buffer, lightingLump.fileofs, lightingLump.filelen);
            bspData.lightingExp = new Int8Array(buffer, lightingLump.fileofs, lightingLump.filelen);
            
            var texDataStringTableLump = header.lumps[LUMP_TEXDATA_STRING_TABLE];
            var texDataStringTable = new Int32Array(buffer, texDataStringTableLump.fileofs, texDataStringTableLump.filelen/4);
            bspData.texDataStrings = this._parseStringTable(buffer, header.lumps[LUMP_TEXDATA_STRING_DATA], texDataStringTable); // Possible alignment issues here!
            
            var gameLumpOffset = header.lumps[LUMP_GAME_LUMP].fileofs;
            var gameLumpHeader = dgamelumpheader_t.readStructs(buffer, gameLumpOffset, 1)[0];
            bspData.gameLumps = dgamelump_t.readStructs(buffer, gameLumpOffset + dgamelumpheader_t.byteLength, gameLumpHeader.lumpCount);
            
            this._parseGameLumps(buffer, bspData, bspData.gameLumps);
            
            return bspData;
        }
    },
    
    _parseLump: {
        value: function(buffer, lump, struct) {
            return struct.readStructs(buffer, lump.fileofs, lump.filelen/struct.byteLength);
        }
    },
    
    _parseStringTable: {
        value: function(buffer, lump, texDataStringTable) {
            var strings = [];
            var bytes = new Uint8Array(buffer, lump.fileofs, lump.filelen);
            
            for(var i = 0; i < texDataStringTable.length; i++) {
                var offset = texDataStringTable[i];
                
                var charCode, newString = "";
                while(true) {
                    charCode = bytes[offset++];
                    if(charCode == 0) {
                        strings.push(newString);
                        break; 
                    }
                    newString += String.fromCharCode(charCode);
                }
            }
            
            return strings;
        }
    },
    
    _parseGameLumps: {
        value: function(buffer, bspData, gameLumps) {
            for(var gameLumpId in gameLumps) {
                var gameLump = gameLumps[gameLumpId];
                
                switch(gameLump.id) {
                    case GAMELUMP_STATIC_PROPS:
                        this._parseStaticProps(buffer, bspData, gameLump);
                        break;
                }
            }
        }
    },
    
    _parseStaticProps: {
        value: function(buffer, bspData, gameLump) {
            var offset = gameLump.fileofs;
            
            var staticPropDictHeader = StaticPropDictLumpHeader_t.readStructs(buffer, offset, 1)[0];
            offset += StaticPropDictLumpHeader_t.byteLength;
            bspData.staticPropDict = StaticPropDictLump_t.readStructs(buffer, offset, staticPropDictHeader.dictEntries);
            offset += StaticPropDictLump_t.byteLength * staticPropDictHeader.dictEntries;
            
            var staticPropLeafHeader = StaticPropLeafLumpHeader_t.readStructs(buffer, offset, 1)[0];
            offset += StaticPropLeafLumpHeader_t.byteLength;
            bspData.staticPropLeaves = StaticPropLeafLump_t.readStructs(buffer, offset, staticPropLeafHeader.leafEntries);
            offset += StaticPropLeafLump_t.byteLength * staticPropLeafHeader.leafEntries;
            
            var staticPropHeader = StaticPropLumpHeader_t.readStructs(buffer, offset, 1)[0];
            offset += StaticPropLumpHeader_t.byteLength;
            bspData.staticProps = StaticPropLump_t.readStructs(buffer, offset, staticPropHeader.propEntries);
            offset += StaticPropLump_t.byteLength * staticPropLeafHeader.leafEntries;
        }
    },
    
    _processFaces: {
        value: function(gl, bspData) {
            var vertices = [];
            var indices = [];
            var vertexBase = 0;
            var rootPoint, pointA, pointB;
            var rootVertId, vertId;
            var texData, texInfo, face;
            
            // Sort the faces by material
            for(var faceId in bspData.faces) {
                face = bspData.faces[faceId];
                
                texInfo = bspData.texInfo[face.texinfo];
                
                if(texInfo.texdata == -1 ||
                    face.dispinfo != -1 ||
                    //face.m_NumPrims != 0 || 
                    (texInfo.flags & SURF_SKIP) || 
                    (texInfo.flags & SURF_NODRAW) || 
                    (texInfo.flags & SURF_TRIGGER) ||
                    (texInfo.flags & SURF_SKY) ||
                    (texInfo.flags & SURF_SKY2D)
                    ) {
                    continue;
                }
                
                texData = bspData.texData[texInfo.texdata];
                texData.addFace(faceId);
                texData.numvertex += face.numedges;
            }
            
            // Create the verts, divided into locking groups
            bspData.lockGroups = [];
            
            var lockGroup = {
                vertexOffset: 0,
                vertexCount: 0,
                indexOffset: 0,
                indexCount: 0,
                triPatches: [] 
            };
            
            var lightmap = Object.create(SourceLightmap).init(gl);

            for(var texDataId in bspData.texData) {
                texData = bspData.texData[texDataId];
                
                if(!texData.faces) { continue; }
                
                // If this texData will push us over our indexable vertex limit, finalize this lock group
                // and create a new one with the appropriate offsets
                if(lockGroup.vertexCount + texData.numvertex > MAX_INDEX) {
                    bspData.lockGroups.push(lockGroup);
                    vertexBase += lockGroup.vertexCount;
                    
                    var newLockGroup = {
                        vertexOffset: lockGroup.vertexOffset + (lockGroup.vertexCount*this.VERTEX_STRIDE),
                        vertexCount: 0,
                        indexOffset: lockGroup.indexOffset + (lockGroup.indexCount*2),
                        indexCount: 0,
                        triPatches: []
                    };
                    lockGroup = newLockGroup;
                }
                
                var triPatch = {
                    indexOffset: lockGroup.indexCount*2,
                    indexCount: 0,
                    texData: texData,
                    lightmap: lightmap,
                };
                
                for(var faceId in texData.faces) {
                    face = bspData.faces[texData.faces[faceId]];
                    texInfo = bspData.texInfo[face.texinfo];
                    var edgeId = face.firstedge;
                    var faceTexData = bspData.texData[texInfo.texdata];
                    
                    // Just incase culling by face turns out to be viable
                    face.lockGroup = lockGroup;
                    face.indexOffset = lockGroup.indexCount*2;
                    face.indexCount = 0;
                    
                    if(face.lightofs != -1) {
                        // Load the lighting for this face
                        if(!lightmap.loadFaceLighting(gl, face, bspData.lighting, bspData.lightingExp)) {
                            // If the current lightmap is full, change over to a new one
                            if(triPatch.indexCount > 0) {
                                lockGroup.triPatches.push(triPatch);
                            }
                            
                            lightmap.finalize(gl);
                        
                            lightmap = Object.create(SourceLightmap).init(gl);
                            lightmap.loadFaceLighting(gl, face, bspData.lighting, bspData.lightingExp)
                        
                            triPatch = {
                                indexOffset: lockGroup.indexCount*2,
                                indexCount: 0,
                                texData: texData,
                                lightmap: lightmap,
                            };
                        }
                    }
                    
                    // Just... ugh :(
                    var vertLookupTable = {};
                    
                    for(var i = 0; i < face.numedges; ++i) {
                        var surfEdge = bspData.surfEdges[edgeId+i];
                        var edge = bspData.edges[Math.abs(surfEdge)];
                        var reverse = (surfEdge >= 0);
                        
                        if(i == 0) {
                            rootVertId = edge.v[reverse?0:1];
                            rootPoint = this._compileGpuVertex(bspData.vertices[rootVertId], face, texInfo, texData, vertices);
                            vertLookupTable[rootVertId] = rootPoint;
                            lockGroup.vertexCount++;
                            
                            vertId = edge.v[reverse?1:0];
                            pointB = this._compileGpuVertex(bspData.vertices[vertId], face, texInfo, texData, vertices);
                            vertLookupTable[vertId] = pointB;
                            lockGroup.vertexCount++;
                            
                        } else {
                            vertId = edge.v[reverse?0:1];
                            if(vertId == rootVertId) { continue; }
                            if(vertId in vertLookupTable) {
                                pointA = vertLookupTable[vertId];
                            } else {
                                pointA = this._compileGpuVertex(bspData.vertices[vertId], face, texInfo, texData, vertices);
                                vertLookupTable[vertId] = pointA;
                                lockGroup.vertexCount++;
                            }
                            
                            vertId = edge.v[reverse?1:0];
                            if(vertId == rootVertId) { continue; }
                            if(vertId in vertLookupTable) {
                                pointB = vertLookupTable[vertId];
                            } else {
                                pointB = this._compileGpuVertex(bspData.vertices[vertId], face, texInfo, texData, vertices);
                                vertLookupTable[vertId] = pointB;
                                lockGroup.vertexCount++;
                            }
                            
                            indices.push(rootPoint - vertexBase);
                            indices.push(pointA - vertexBase);
                            indices.push(pointB - vertexBase);
                            
                            lockGroup.indexCount += 3;
                            triPatch.indexCount += 3;
                            face.indexCount += 3;
                        }
                    }
                }
                
                if(triPatch.indexCount > 0) {
                    lockGroup.triPatches.push(triPatch);
                }
            }
            
            lightmap.finalize(gl);
            
            bspData.lockGroups.push(lockGroup);
            
            bspData.vertexArray = vertices;
            bspData.indexArray = indices;
        }
    },
    
    _initializeShaders: {
        value: function(gl) {
            this.shader = glUtil.createShaderProgram(gl, meshVS, meshFS,
                ['position', 'texture', 'light'],
                ['modelViewMat', 'projectionMat', 'diffuse', 'lightmap']
            );
        }
    },
    
    _loadMaterials: {
        value: function(gl, bspData) {
            for(var texDataId in bspData.texData) {
                var texData = bspData.texData[texDataId];
                var materialName = bspData.texDataStrings[texData.nameStringTableID];
                
                // Only load materials that will have visible faces
                // Note: This must run after _processFaces
                if(texData.faces) {
                    texData.material = Object.create(SourceMaterial).load(gl, "root/tf/materials/" + materialName);
                }
            }
        }
    },
    
    _compileBuffers: {
        value: function(gl, bspData) {
            this.vertBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bspData.vertexArray), gl.STATIC_DRAW);

            this.indexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(bspData.indexArray), gl.STATIC_DRAW);
        }
    },
    
    _compileGpuVertex: {
        value: function(pos, face, texInfo, texData, vertices) {
            var tu = texInfo.textureVecsTexelsPerWorldUnits[0]; 
            var tv = texInfo.textureVecsTexelsPerWorldUnits[1];
            
            var lu = texInfo.lightmapVecsLuxelsPerWorldUnits[0]; 
            var lv = texInfo.lightmapVecsLuxelsPerWorldUnits[1];
            
            var lm = face.m_LightmapTextureMinsInLuxels; 
            var ls = face.m_LightmapTextureSizeInLuxels;
            
            var index = vertices.length / this.VERTEX_ELEMENTS; 
            
            // Vertex Position
            vertices.push(pos.x);
            vertices.push(pos.y);
            vertices.push(pos.z);
            
            // Texture Coord calculation
            var vtu = (tu.x * pos.x + tu.y * pos.y + tu.z * pos.z + tu.offset) / texData.width; 
            var vtv = (tv.x * pos.x + tv.y * pos.y + tv.z * pos.z + tv.offset) / texData.height;
            
            vertices.push(vtu);
            vertices.push(vtv);
            
            // Lightmap Coord Calculation
            var vlu = (lu.x * pos.x + lu.y * pos.y + lu.z * pos.z + lu.offset - lm[0]) / (ls[0] + 1); 
            var vlv = (lv.x * pos.x + lv.y * pos.y + lv.z * pos.z + lv.offset - lm[1]) / (ls[1] + 1);
            
            // Compensate for packed textures
            vlu = (vlu * face.lightmapScaleX) + face.lightmapOffsetX;
            vlv = (vlv * face.lightmapScaleY) + face.lightmapOffsetY;
            
            vertices.push(vlu);
            vertices.push(vlv);
            
            return index;
        }
    },
    
    draw: {
        value: function(gl, modelViewMat, projectionMat) {
            var shader = this.shader;

            if(!shader || !this.vertBuffer) { return; }
            
            gl.useProgram(shader);
            
            gl.bindTexture(gl.TEXTURE_2D, this.defaultTexture);
            gl.uniform1i(shader.uniform.diffuse, 0);
            
            gl.uniformMatrix4fv(shader.uniform.projectionMat, false, projectionMat);
            gl.uniformMatrix4fv(shader.uniform.modelViewMat, false, modelViewMat);

            // Enable vertex arrays
            gl.enableVertexAttribArray(shader.attribute.position);
            gl.enableVertexAttribArray(shader.attribute.texture);
            gl.enableVertexAttribArray(shader.attribute.light);
            
            // Bind the appropriate buffers
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            
            var lastLightmap = null;
            
            // Loop through the locking groups
            for(var lockGroupId in this.lockGroups) {
                var lockGroup = this.lockGroups[lockGroupId];
                
                // Draw the mesh
                gl.vertexAttribPointer(shader.attribute.position, 3, gl.FLOAT, false, this.VERTEX_STRIDE, lockGroup.vertexOffset + 0);
                gl.vertexAttribPointer(shader.attribute.texture, 2, gl.FLOAT, false, this.VERTEX_STRIDE, lockGroup.vertexOffset + 12);
                gl.vertexAttribPointer(shader.attribute.light, 2, gl.FLOAT, false, this.VERTEX_STRIDE, lockGroup.vertexOffset + 20);
                
                // Loop through each triangle patch within the lock group and render them
                for(var triPatchId in lockGroup.triPatches) {
                    var triPatch = lockGroup.triPatches[triPatchId];
                    
                    if(triPatch.lightmap !== lastLightmap) {
                        gl.activeTexture(gl.TEXTURE1);
                        gl.bindTexture(gl.TEXTURE_2D, triPatch.lightmap.texture);
                        gl.uniform1i(shader.uniform.lightmap, 1);
                        lastLightmap = triPatch.lightmap;
                    }
                    
                    var texture = null;
                    if(triPatch.texData && triPatch.texData.material) {
                        texture = triPatch.texData.material.texture;
                    }
                    if(!texture) {
                        texture = this.defaultTexture;
                    }
                    
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.uniform1i(shader.uniform.diffuse, 0);
                    
                    gl.drawElements(gl.TRIANGLES, triPatch.indexCount, gl.UNSIGNED_SHORT, lockGroup.indexOffset + triPatch.indexOffset);
                }
            }
        }
    }
});

//=================
// Source Lightmap
// (A good deal of this is reused from my Quake 2 demo)
//=================

var LIGHTMAP_SIZE = 512;

var SourceLightmap = Object.create(Object, {
    // WebGL texture
    texture: {
        value: null
    },
    
    // Used to calculate where new texture allocations should take place
    rectTree: {
        value: null
    },
    
    init: {
        value: function(gl) {
            this.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, LIGHTMAP_SIZE, LIGHTMAP_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            
            // Set the last few pixels to white (for non-lightmapped faces)
        	var whitePixels = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
        	gl.texSubImage2D(gl.TEXTURE_2D, 0, LIGHTMAP_SIZE-2, LIGHTMAP_SIZE-2, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, whitePixels);

            this.rectTree = {
                x: 0, 
                y: 0,
                width: LIGHTMAP_SIZE, 
                height: LIGHTMAP_SIZE
            };
            
            return this;
        }
    },
    
    // Read lightmap from BSP file
    loadFaceLighting: {
        value: function(gl, face, lighting, lightingExp) {
            var width = face.m_LightmapTextureSizeInLuxels[0] + 1;
            var height = face.m_LightmapTextureSizeInLuxels[1] + 1;
            
            if(height <= 0 || width <= 0) { return null; }
            
            var styleCount;
            for(styleCount = 0; styleCount < face.styles.length; styleCount++) { 
                if(face.styles[styleCount] == 255) { break; }
            }
            
            function clamp(value) {
                return value > 255 ? 255 : value < 0 ? 0 : value;
            }

            // Navigate lightmap BSP to find correctly sized space
            // Allocate room for a 1 pixel border to prevent bleeding from other lightmaps
            var node = this._allocateRect(width+2, height+2);

            if(node) {
                // Read the lightmap from the BSP file
                var byteCount = width * height * 4;
                var borderedByteCount = (width+2) * (height+2) * 4; // includes border
                var rowBytes = (width+2) * 4;
                
                var lightmap = new Uint8Array(borderedByteCount);
                
                for(var j = 0; j < styleCount; ++j) {
                    var lightOffset = face.lightofs + (byteCount*j);
                    var lightbuffer = lighting.subarray(lightOffset, lightOffset + byteCount);
                    var expbuffer = lightingExp.subarray(lightOffset + 3, lightOffset + byteCount - 3);
                    
                    var i = 0;
                    
                    // Fill out the lightmap, minus borders
                    for(var y = 0; y < height; ++y) {
                        var o = (rowBytes * (y+1)) + 4;
                        for(var x = 0; x < width; ++x) {
                            var exp = Math.pow(2, expbuffer[i]);
                            lightmap[o] = clamp(lightmap[o] + (lightbuffer[i] * exp)); ++i; ++o;
                            lightmap[o] = clamp(lightmap[o] + (lightbuffer[i] * exp)); ++i; ++o;
                            lightmap[o] = clamp(lightmap[o] + (lightbuffer[i] * exp)); ++i; ++o;
                            lightmap[o] = 255; ++i; ++o;
                        }
                    }
                    
                    // Generate the borders
                    this._fillBorders(lightmap, width+2, height+2);
                }
                
                // Copy the lightmap into the allocated rectangle
                gl.bindTexture(gl.TEXTURE_2D, this.texture);
                gl.texSubImage2D(gl.TEXTURE_2D, 0, node.x, node.y, width+2, height+2, gl.RGBA, gl.UNSIGNED_BYTE, lightmap);
                
                face.lightmapOffsetX = (node.x+1) / LIGHTMAP_SIZE;
                face.lightmapOffsetY = (node.y+1) / LIGHTMAP_SIZE;
                face.lightmapScaleX = width / LIGHTMAP_SIZE;
                face.lightmapScaleY = height / LIGHTMAP_SIZE;
            }
            return node;
        }
    },
    
    _fillBorders: {
        value: function(lightmap, width, height) {
            var rowBytes = width * 4;
            var o;
            
            // Fill in the sides
            for(var y = 1; y < height-1; ++y) {
                // left side
                o = rowBytes * y;
                lightmap[o] = lightmap[o + 4]; ++o;
                lightmap[o] = lightmap[o + 4]; ++o;
                lightmap[o] = lightmap[o + 4]; ++o;
                lightmap[o] = lightmap[o + 4];
                
                // right side
                o = (rowBytes * (y+1)) - 4;
                lightmap[o] = lightmap[o - 4]; ++o;
                lightmap[o] = lightmap[o - 4]; ++o;
                lightmap[o] = lightmap[o - 4]; ++o;
                lightmap[o] = lightmap[o - 4];
            }
            
            var end = width * height * 4;
            
            // Fill in the top and bottom
            for(var x = 0; x < rowBytes; ++x) {
                lightmap[x] = lightmap[x + rowBytes];
                lightmap[(end-rowBytes) + x] = lightmap[(end-(rowBytes*2) + x)];
            }
        }
    },
    
    // Navigate the Lightmap BSP tree and find an empty spot of the right size
    _allocateRect: {
        value: function(width, height, node) {
            if(!node) { node = this.rectTree; }
            
            // Check children node
            if(node.nodes != null) { 
                var retNode = this._allocateRect(width, height, node.nodes[0]);
                if(retNode) { return retNode; }
                return this._allocateRect(width, height, node.nodes[1]);
            }

            // Already used
            if(node.filled) { return null; }

            // Too small
            if(node.width < width || node.height < height) { return null; }

            // Perfect fit. Allocate without splitting
            if(node.width == width && node.height == height) {
                node.filled = true;
                return node;
            }

            // We need to split if we've reached here
            var nodes;

            // Which way do we split?
            if ((node.width - width) > (node.height - height)) {
                nodes = [
                    {
                        x: node.x, y: node.y,
                        width: width, height: node.height
                    },
                    {
                        x: node.x+width, y: node.y,
                        width: node.width - width, height: node.height
                    }
                ];
            } else {
                nodes = [
                    {
                        x: node.x, y: node.y,
                        width: node.width, height: height
                    },
                    {
                        x: node.x, y: node.y+height,
                        width: node.width, height: node.height - height
                    }
                ];
            }
            node.nodes = nodes;
            return this._allocateRect(width, height, node.nodes[0]);
        }
    },
    
    // Read lightmap from BSP file
    finalize: {
        value: function(gl) {
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.generateMipmap(gl.TEXTURE_2D);
        }
    }
});