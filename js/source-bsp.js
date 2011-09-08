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
var mapVS = "attribute vec3 position;\n";
mapVS += "attribute vec2 texture;\n";
mapVS += "attribute vec2 light;\n";

mapVS += "uniform mat4 viewMat;\n";
mapVS += "uniform mat4 projectionMat;\n";

mapVS += "varying vec2 texCoord;\n";
mapVS += "varying vec2 lightCoord;\n";

mapVS += "void main(void) {\n";
mapVS += " vec4 vPosition = viewMat * vec4(position, 1.0);\n";
mapVS += " texCoord = texture;\n";
mapVS += " lightCoord = light;\n";
mapVS += " gl_Position = projectionMat * vPosition;\n";
mapVS += "}";

// Fragment Shader
var mapFS = "uniform sampler2D diffuse;";
mapFS += "uniform sampler2D lightmap;";
mapFS += "varying vec2 texCoord;\n";
mapFS += "varying vec2 lightCoord;\n";
mapFS += "void main(void) {\n";
mapFS += " vec4 light = texture2D(lightmap, lightCoord);\n";
mapFS += " vec4 color = texture2D(diffuse, texCoord);\n";
mapFS += " vec3 ambient = vec3(0.15, 0.15, 0.15);\n"; 
mapFS += " gl_FragColor = vec4(color.rgb * (light.rgb + ambient), color.a);\n";
//mapFS += " gl_FragColor = vec4(light.rgb, 1.0);\n";
//mapFS += " gl_FragColor = color;\n";
mapFS += "}";

var SourceBspTree = Object.create(Object, {
    planes: {
        value: null
    },
    
    models: {
        value: null
    },
    
    nodes: {
        value: null
    },
    
    leaves: {
        value: null
    },
    
    leafFaces: {
        value: null
    },
    
    clusterVis: {
        value: null
    },
    
    numClusters: {
        value: 0
    },

    parse: {
        value: function(buffer, header, planes) {
            this.planes = this._parseLump(buffer, header.lumps[LUMP_PLANES], dplane_t);
            this.models = this._parseLump(buffer, header.lumps[LUMP_MODELS], dmodel_t);
            this.nodes = this._parseLump(buffer, header.lumps[LUMP_NODES], dnode_t);
            this.leaves = this._parseLump(buffer, header.lumps[LUMP_LEAFS], dleaf_t);
            
            var leafFaceLump = header.lumps[LUMP_LEAFFACES];
            this.leafFaces = new Uint16Array(buffer, leafFaceLump.fileofs, leafFaceLump.filelen/2); // Possible alignment issues here!
            
            this._parseVis(buffer, header.lumps[LUMP_VISIBILITY]);
            
            return this;
        }
    },
    
    _parseLump: {
        value: function(buffer, lump, struct) {
            return struct.readStructs(buffer, lump.fileofs, lump.filelen/struct.byteLength);
        }
    },
    
    getLeafId: {
        value: function(pos) {
            var model = this.models[0];
            var index = model.headnode;
            var node = null;
            var plane = null;
            var normal = vec3.create();
            var dist = 0;
            
            // This should be a very fast trace down to the leaf that the given position is located in.
            while (index >= 0) {
                node = this.nodes[index];
                plane = this.planes[node.planenum];
                normal[0] = plane.normal.x; normal[1] = plane.normal.y; normal[2] = plane.normal.z; // TODO: Not this.
                
                dist = vec3.dot(normal, pos) - plane.dist;

                if (dist >= 0) {
                    index = node.children[0];
                } else {
                    index = node.children[1];
                }
            }

            return -(index+1);
        }
    },
    
    getLeafFaces: {
        value: function(leafId) {
            var leaf = this.leaves[leafId];
            return this.leafFaces.subarray(leaf.firstleafface, leaf.firstleafface + leaf.numleaffaces);
        }
    },
    
    addPropToLeaf: {
        value: function(leafId, propId) {
            var leaf = this.leaves[leafId];
            leaf.addProp(propId);
        }
    },
    
    getLeafProps: {
        value: function(leafId) {
            return this.leaves[leafId].props;
        }
    },
    
    /**
     * Determine if the given leaf is one that contains visibility information
     */
    isVisLeaf: {
        value: function(leafId) {
            return this.leaves[leafId].cluster != -1;
        }
    },
    
    _parseVis: {
        value: function(buffer, lump) {
            var offset = lump.fileofs;
            
            var visHeader = dvisheader_t.readStructs(buffer, offset, 1)[0];
            offset += dvisheader_t.byteLength;
            var numCluster = this.numClusters = visHeader.numclusters;
            var visOffsets = dvis_t.readStructs(buffer, offset, numCluster);
            var numBytes = Math.ceil(numCluster / 8);
            
            // This is wasting a lot of space, but it's a straightforward method for the time being
            // TODO: Optimize later
            var clusterVis = this.clusterVis = new Uint8Array(numCluster * numCluster);
            for(var i = 0; i < numCluster; ++i) {
                var rleVis = new Uint8Array(buffer, lump.fileofs + visOffsets[i].visofs, numBytes);
                var clusterOfs = i * numCluster;
                var v = 0;
                
                // Unpack the RLE visibility bitfield
                // See code at: http://www.flipcode.com/archives/Quake_2_BSP_File_Format.shtml
                for (var c = 0; c < numCluster; v++) {
                   if (rleVis[v] == 0) {
                      v++;     
                      c += 8 * rleVis[v];
                   } else {
                      for (var bit = 1; bit < 256; bit *= 2, c++) {
                         if (rleVis[v] & bit) {
                            clusterVis[clusterOfs + c] = 1;
                         }
                      }
                   }
                }
            }
        }
    },
    
    isLeafVisible: {
        value: function(fromLeafId, toLeafId) {
            if(fromLeafId == toLeafId) { return true; } // Leaves are always visible from themselves
            
            var fromLeaf = this.leaves[fromLeafId];
            var toLeaf = this.leaves[toLeafId];
            
            if(fromLeaf.cluster == -1 || !toLeaf.cluster == -1) { return false; }
            
            return this.clusterVis[(fromLeaf.cluster * this.numClusters) + toLeaf.cluster];
        }
    },
    
});

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
    
    staticPropDict: {
        value: null
    },
    
    staticProps: {
        value: null
    },
    
    faces: {
        value: null
    },
    
    bspTree: {
        value: null
    },
    
    lastLeaf: {
        value: -1
    },
    
    frameCount: {
        value: -1
    },
    
    complete: {
        value: false
    },
    
    entities: {
        value: null
    },
    
    load: {
        value: function(gl, url, callback) {
            this._initializeShaders(gl);
            
            var self = this;
            this.complete = false;
            
            var bspXhr = new XMLHttpRequest();
            bspXhr.open('GET', url + ".bsp", true);
            bspXhr.responseType = "arraybuffer";
            bspXhr.addEventListener("load", function() {
                var bspData = self._parseBsp(this.response);
                self._processFaces(gl, bspData);
                self.faces = bspData.faces;
                self.lockGroups = bspData.lockGroups;
                self.entities = bspData.entities;
                
                self._loadMaterials(gl, bspData);
                self._loadStaticProps(gl, bspData);
                self._compileBuffers(gl, bspData);
                self.complete = true;
                if(callback) { callback(self); }
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
                vertices: this._parseLump(buffer, header.lumps[LUMP_VERTEXES], Vector),
                edges: this._parseLump(buffer, header.lumps[LUMP_EDGES], dedge_t),
                faces: this._parseLump(buffer, header.lumps[LUMP_FACES], dface_t),
                texInfo: this._parseLump(buffer, header.lumps[LUMP_TEXINFO], texinfo_t),
                texData: this._parseLump(buffer, header.lumps[LUMP_TEXDATA], dtexdata_t),
                brushes: this._parseLump(buffer, header.lumps[LUMP_BRUSHES], dbrush_t),
                brushSides: this._parseLump(buffer, header.lumps[LUMP_BRUSHSIDES], dbrushside_t),
            };
            
            this.bspTree = Object.create(SourceBspTree).parse(buffer, header);
            
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
            
            bspData.entities = this._parseEntities(buffer, header.lumps[LUMP_ENTITIES]);
            
            return bspData;
        }
    },
    
    _parseLump: {
        value: function(buffer, lump, struct) {
            return struct.readStructs(buffer, lump.fileofs, lump.filelen/struct.byteLength);
        }
    },
    
    // Read all entity structures
    _parseEntities: {
        value: function(buffer, lump) {
            var entities = Struct.readString(buffer, lump.fileofs, lump.filelen);
            
            var elements = {
                targets: {}
            };

            entities.replace(/\{([^}]*)\}/mg, function($0, entitySrc) {
                var entity = {
                    classname: 'unknown'
                };
                entitySrc.replace(/"(.+)" "(.+)"$/mg, function($0, key, value) {
                    switch(key) {
                        case 'origin':
                        case 'angles':
                            value.replace(/(.+) (.+) (.+)/, function($0, x, y, z) {
                                entity[key] = [
                                    parseFloat(x), 
                                    parseFloat(y), 
                                    parseFloat(z)
                                ];
                            });
                            break;
                        case 'angle':
                            entity[key] = parseFloat(value);
                            break;
                        default:
                            entity[key] = value;
                            break;
                    }
                });

                if(entity['targetname']) {
                    elements.targets[entity['targetname']] = entity;
                }

                if(!elements[entity.classname]) { elements[entity.classname] = new Array(); }
                elements[entity.classname].push(entity);
            });

            return elements;
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
    
    _loadStaticProps: {
        value: function(gl, bspData) {
            this.staticPropDict = bspData.staticPropDict;
            this.staticProps = bspData.staticProps;
            
            for(var propId in bspData.staticPropDict) {
                var propDict = bspData.staticPropDict[propId];
                propDict.model = Object.create(SourceModel).load(gl, "root/tf/" + propDict.m_Name);
            }
            
            for(var propId = 0; propId < bspData.staticProps.length; ++propId) {
                var prop = bspData.staticProps[propId];
                var origin = prop.m_Origin;
                var angle = prop.m_Angles;
                
                var modelMat = mat4.create();
                mat4.identity(modelMat);
                mat4.translate(modelMat, [origin.x, origin.y, origin.z]);
                
                mat4.rotateZ(modelMat, angle.y * (Math.PI/180));
                mat4.rotateX(modelMat, angle.z * (Math.PI/180));
                mat4.rotateY(modelMat, angle.x * (Math.PI/180));
                
                prop.modelMat = modelMat;
                
                var propLastLeaf = prop.m_FirstLeaf + prop.m_LeafCount;
                for(var i = prop.m_FirstLeaf; i < propLastLeaf; ++i) {
                    this.bspTree.addPropToLeaf(i, propId);
                }
            }
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
                    //face.dispinfo != -1 ||
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
                    renderFrame: -1,
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
                    face.lightmap = lightmap;
                    face.triPatch = triPatch;
                    
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
                                renderFrame: -1,
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
            this.shader = glUtil.createShaderProgram(gl, mapVS, mapFS,
                ['position', 'texture', 'light'],
                ['viewMat', 'projectionMat', 'diffuse', 'lightmap']
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
        value: function(gl, pos, viewMat, projectionMat) {
            if(!this.complete) { return; }
            
            var leafId = this.bspTree.getLeafId(pos);
            var newLeaf = this.lastLeaf != leafId;
            this.lastLeaf = leafId;
            
            var frameCount = this.frameCount;
            var cullFrame = this.bspTree.isVisLeaf(leafId);
            
            // Flag all visible triPatches (This only needs to update if we're in a new leaf)
            if(cullFrame && newLeaf) {
                frameCount = ++this.frameCount;
                this._flagVisibleTriPatches(leafId, frameCount);
            }
            
            var shader = this.shader;
            var lastLightmap = null;
            
            // Now we get down to the rendering loop
            gl.useProgram(shader);
            
            gl.bindTexture(gl.TEXTURE_2D, this.defaultTexture);
            gl.uniform1i(shader.uniform.diffuse, 0);
            
            gl.uniformMatrix4fv(shader.uniform.projectionMat, false, projectionMat);
            gl.uniformMatrix4fv(shader.uniform.viewMat, false, viewMat);
            
            // Bind the appropriate buffers
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

            // Enable vertex arrays
            gl.enableVertexAttribArray(shader.attribute.position);
            gl.enableVertexAttribArray(shader.attribute.texture);
            gl.enableVertexAttribArray(shader.attribute.light);
            
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
                    if(cullFrame && triPatch.renderFrame != frameCount) { continue; }
                
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
            
            for(var propId in this.staticProps) {
                var prop = this.staticProps[propId];
                if(cullFrame && prop.renderFrame != frameCount) { continue; }
                var propDict = this.staticPropDict[prop.m_PropType];
                if(propDict.model) {
                    propDict.model.draw(gl, viewMat, projectionMat, prop.modelMat);
                }
            }
        }
    },
    
    // Trick that was picked up from the Quake Source. We flag the triPatches that need rendering with the current frame number
    // which avoids reseting all the flags to 0 each frame. Then once the flagging is done, we render all faces that share a material
    // In a single call 
    _flagVisibleTriPatches: {
        value: function(leafId, frame) {
            var leafCount = this.bspTree.leaves.length;
            for(var l = 0; l < leafCount; ++l) {
                if(!this.bspTree.isLeafVisible(leafId, l)) { continue; }
                
                var leafProps = this.bspTree.getLeafProps(l);
                if(leafProps) {
                    var leafPropCount = leafProps.length;
                    for(var i = 0; i < leafPropCount; ++i) {
                        var prop = this.staticProps[leafProps[i]];
                        prop.renderFrame = frame;
                    }
                }
                
                var leafFaces = this.bspTree.getLeafFaces(l);
                var leafFaceCount = leafFaces.length;
                for(var i = 0; i < leafFaceCount; ++i) {
                    // TODO: This could be a lot more efficent if we told the leafs about their associated triPatches directly
                    var face = this.faces[leafFaces[i]]; 
                    if(face.triPatch) {
                        face.triPatch.renderFrame = frame;
                        // TODO: Is it worthwhile to flag a min/max index here?
                    }
                }
            }
        }
    }
});
