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

//
// Basic lightmap shader
//

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
mapFS += "}";

//
// Shader for running an early Z pass over the scene
//

// Vertex Shader
var depthPassVS = "attribute vec3 position;\n";
depthPassVS += "uniform mat4 viewMat;\n";
depthPassVS += "uniform mat4 modelMat;\n";
depthPassVS += "uniform mat4 projectionMat;\n";
depthPassVS += "void main(void) {\n";
depthPassVS += " mat4 modelViewMat = viewMat * modelMat;\n";
depthPassVS += " vec4 vPosition = modelViewMat * vec4(position, 1.0);\n";
depthPassVS += " gl_Position = projectionMat * vPosition;\n";
depthPassVS += "}";

// Fragment Shader
var depthPassFS = "void main(void) {\n";
depthPassFS += " gl_FragColor = vec4(0,0,0,0);\n";
depthPassFS += "}";

//
// Shader for the skybox
//

var skyVS = "attribute vec3 position;\n";
skyVS += "uniform mat4 viewMat;\n";
skyVS += "uniform mat4 projectionMat;\n";

skyVS += "varying vec3 texCoord;\n";

skyVS += "void main(void) {\n";
skyVS += " mat4 skyMat = viewMat;\n";
skyVS += " skyMat[3][0] = 0.0;\n";
skyVS += " skyMat[3][1] = 0.0;\n";
skyVS += " skyMat[3][2] = 0.0;\n";
skyVS += " vec4 vPosition = skyMat * vec4(position, 1.0);\n";
skyVS += " texCoord = position;\n";
skyVS += " gl_Position = projectionMat * vPosition;\n";
skyVS += "}";

// Fragment Shader
var skyFS = "uniform samplerCube diffuse;";
skyFS += "varying vec3 texCoord;\n";
skyFS += "void main(void) {\n";
skyFS += " vec4 color = textureCube(diffuse, texCoord.xzy);\n";
skyFS += " gl_FragColor = vec4(color);\n";
skyFS += "}";

var sourceBspShader = null;
var depthPassShader = null;
var skyboxShader = null;

var SourceBsp = Object.create(Object, {
    VERTEX_STRIDE: {
        value: 28
    },
    
    VERTEX_ELEMENTS: {
        value: 7
    },
    
    DEPTH_PREPASS: {
        value: false
    },
    
    shader: {
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
    
    propVertBuffer: {
        value: null
    },
    
    propIndexBuffer: {
        value: null
    },
    
    skyboxVertBuffer: {
        value: null
    },
    
    skyboxIndexBuffer: {
        value: null
    },
    
    skyboxIndexCount: {
        value: 0
    },
    
    skyboxCubemap: {
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
    
    onMaterialsComplete: {
        value: null
    },
    
    load: {
        value: function(gl, url, callback) {
            this._initializeShaders(gl);
            SourceModel.initializeShaders(gl);
            
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
                self._loadSkybox(gl, self.entities);
                self.complete = true;
                if(callback) { callback(self); }
            });
            bspXhr.send(null);

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
            
            this._parseDynamicProps(bspData.entities, bspData);
            
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
    
    _parseDynamicProps: {
        value: function(entities, bspData) {
            var dynamicPropDict = {};
            
            var dynamicPropEntities = entities.prop_dynamic;
            for(var propId in dynamicPropEntities) {
                var prop = dynamicPropEntities[propId];
                var modelType = prop.model;
                
                var propDict = dynamicPropDict[modelType];
                if(!propDict) {
                    dynamicPropDict[modelType] = propDict = Object.create(StaticPropDictLump_t);
                    propDict.m_Name = modelType;
                    bspData.staticPropDict.push(propDict);
                    propDict.propDictId = bspData.staticPropDict.length - 1;
                }
                
                var dynamicProp = Object.create(StaticPropLump_t);
                dynamicProp.m_PropType = propDict.propDictId;
                
                dynamicProp.m_Origin = {
                    x: prop.origin[0],
                    y: prop.origin[1],
                    z: prop.origin[2]
                };
                
                dynamicProp.m_Angles = {
                    x: prop.angles[0],
                    y: prop.angles[1],
                    z: prop.angles[2]
                };
                
                // TODO: WTF? Why do I have to do this???
                if(modelType == "models/props_gameplay/resupply_locker.mdl") {
                    dynamicProp.m_Angles.y += 90;
                }
                
                dynamicProp.m_LightingOrigin = dynamicProp.m_Origin;
                
                dynamicProp.m_LeafCount = 0;
                dynamicProp.m_FirstLeaf = -1;
                
                //propDict.addProp(dynamicProp);
                bspData.staticProps.push(dynamicProp);
                
                var propId = bspData.staticProps.length - 1;
                var leafId = this.bspTree.getLeafId(prop.origin);
                this.bspTree.addPropToLeaf(leafId, propId);
            }
        }
    },
    
    _loadStaticProps: {
        value: function(gl, bspData) {
            var self = this;
            this.staticPropDict = bspData.staticPropDict;
            this.staticProps = bspData.staticProps;
            
            var staticPropCount = bspData.staticPropDict.length;
            var staticPropsLoaded = 0;
            
            for(var propId in bspData.staticPropDict) {
                var propDict = bspData.staticPropDict[propId];
                propDict.mdl = Object.create(SourceModel).load(null, "root/tf/" + propDict.m_Name, function(model) {
                    staticPropsLoaded++;
                    if(staticPropsLoaded == staticPropCount) {
                        self._staticPropsLoaded(gl, bspData.staticPropDict);
                    }
                });
            }
            
            for(var propId = 0; propId < bspData.staticProps.length; ++propId) {
                var prop = bspData.staticProps[propId];
                var origin = prop.m_Origin;
                var angle = prop.m_Angles;
                
                if(prop.m_PropType >= 0) {
                    var propDict = bspData.staticPropDict[prop.m_PropType];
                    propDict.addProp(prop);
                }
                
                var modelMat = mat4.create();
                mat4.identity(modelMat);
                mat4.translate(modelMat, [origin.x, origin.y, origin.z]);
                
                mat4.rotateZ(modelMat, angle.y * (Math.PI/180));
                mat4.rotateY(modelMat, angle.x * (Math.PI/180));
                mat4.rotateX(modelMat, angle.z * (Math.PI/180));
                
                prop.modelMat = modelMat;
                
                var propLastLeaf = prop.m_FirstLeaf + prop.m_LeafCount;
                for(var i = prop.m_FirstLeaf; i < propLastLeaf; ++i) {
                    this.bspTree.addPropToLeaf(bspData.staticPropLeaves[i].m_Leaf, propId);
                }
            }
        }
    },
    
    /**
     * Upload all of the static props into a single, shared buffer for faster rendering
     **/
    _staticPropsLoaded: {
        value: function(gl, props) {
            console.log("All props loaded");
            
            var self = this;
            materialManager.onMaterialsCompleted = function() {
                console.log("All materials loaded");
                self._staticPropMaterialsLoaded(gl, props);
            };
            
            for(var propId in this.staticPropDict) {
                var propDict = this.staticPropDict[propId];
                propDict.mdl.loadSkin(gl, 0);
            }
        }
    },
    
    // Props are loaded, materials are loaded, now we sort and build the buffers
    _staticPropMaterialsLoaded: {
        value: function(gl, props) {
            var vertexArraySize = 0;
            var indexArraySize = 0;
            
            for(var propId in this.staticPropDict) {
                var propDict = this.staticPropDict[propId];
                var model = propDict.model = propDict.mdl.getBspModel();
                vertexArraySize += model.vertexArray.length;
                indexArraySize += model.indexArray.length;
                propDict.mdl = null; // Don't need it any more;
            }
            
            var vertexArray = new Uint8Array(vertexArraySize);
            var indexArray = new Uint16Array(indexArraySize);
            
            var vertexArrayOffset = 0;
            var indexArrayOffset = 0;
            
            var propIndexCount = 0;
            
            for(var propId in this.staticPropDict) {
                var prop = this.staticPropDict[propId];
                var model = prop.model;
                model.vertexOffset = vertexArrayOffset;
                model.indexOffset = indexArrayOffset * 2;
                
                vertexArray.set(model.vertexArray, vertexArrayOffset);
                indexArray.set(model.indexArray, indexArrayOffset);
                
                vertexArrayOffset += model.vertexArray.length;
                indexArrayOffset += model.indexArray.length;
                
                propIndexCount += model.indexArray.length * prop.props.length;
                
                // Don't keep references to the arrays around, we don't need them anymore
                model.vertexArray = null;
                model.indexArray = null;
            }
            
            this.propVertBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.propVertBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);

            this.propIndexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.propIndexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);
            
            if(this.onMaterialsComplete) {
                this.onMaterialsComplete(this);
            }
            
            console.log("Prop Tris: " + propIndexCount / 3);
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
                    translucent: false,
                    displacement: false
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
                                translucent: false,
                                displacement: false
                            };
                        }
                    }
                    
                    face.triPatch = triPatch;
                    
                    if(texInfo.flags & SURF_TRANS) {
                        triPatch.translucent = true; // Flag transparent patches
                    }
                    
                    if(face.dispinfo != -1) {
                        triPatch.displacement = true; 
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
            
            console.log("BSP Tris: " + indices.length / 3);
        }
    },
    
    _loadSkybox: {
        value: function(gl, entities) {
            var skyname = entities.worldspawn[0].skyname;
            if(!skyname) { return; } // No Skybox?
            
            var skyVerts = [
                // x     y     z
                // Front
                -128,  128,  128,
                 128,  128,  128,
                -128, -128,  128,
                 128, -128,  128,
                                 
                // Back          
                 128,  128, -128,
                -128,  128, -128,
                 128, -128, -128,
                -128, -128, -128,
                                 
                // Left          
                -128,  128, -128,
                -128,  128,  128,
                -128, -128, -128,
                -128, -128,  128,
                                 
                // Right         
                 128,  128,  128,
                 128,  128, -128,
                 128, -128,  128,
                 128, -128, -128,
                                 
                // Top           
                -128,  128,  128,
                 128,  128,  128,
                -128,  128, -128,
                 128,  128, -128,
                                 
                // Bottom        
                 128,  -128,  128,
                -128,  -128,  128,
                 128,  -128, -128,
                -128,  -128, -128,
            ];

            var skyIndices = [
                0, 1, 2,
                2, 1, 3,

                4, 5, 6,
                6, 5, 7,

                8, 9, 10,
                10, 9, 11,

                12, 13, 14,
                14, 13, 15,

                16, 17, 18,
                18, 17, 19,
                
                20, 21, 22,
                22, 21, 23,
            ];

            this.skyboxVertBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.skyboxVertBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(skyVerts), gl.STATIC_DRAW);

            this.skyboxIndexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.skyboxIndexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(skyIndices), gl.STATIC_DRAW);

            this.skyboxIndexCount = skyIndices.length;
            
            this.skyboxCubemap = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.skyboxCubemap);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            
            var self = this;
            materialManager.loadMaterial(gl, "root/tf/materials/", null, "skybox/" + skyname + "up", function(material) {
                material.onTextureLoaded = function(image) {
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, self.skyboxCubemap);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                };
            }, true);
            materialManager.loadMaterial(gl, "root/tf/materials/", null, "skybox/" + skyname + "dn", function(material) {
                material.onTextureLoaded = function(image) {
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, self.skyboxCubemap);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                };
            }, true);
            materialManager.loadMaterial(gl, "root/tf/materials/", null, "skybox/" + skyname + "lf", function(material) {
                material.onTextureLoaded = function(image) {
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, self.skyboxCubemap);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                };
            }, true);
            materialManager.loadMaterial(gl, "root/tf/materials/", null, "skybox/" + skyname + "rt", function(material) {
                material.onTextureLoaded = function(image) {
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, self.skyboxCubemap);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                };
            }, true);
            materialManager.loadMaterial(gl, "root/tf/materials/", null, "skybox/" + skyname + "ft", function(material) {
                material.onTextureLoaded = function(image) {
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, self.skyboxCubemap);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                };
            }, true);
            materialManager.loadMaterial(gl, "root/tf/materials/", null, "skybox/" + skyname + "bk", function(material) {
                material.onTextureLoaded = function(image) {
                    gl.bindTexture(gl.TEXTURE_CUBE_MAP, self.skyboxCubemap);
                    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                };
            }, true);
        }
    },
    
    _initializeShaders: {
        value: function(gl) {
            if(!sourceBspShader) {
                sourceBspShader = glUtil.createShaderProgram(gl, mapVS, mapFS,
                    ['position', 'texture', 'light'],
                    ['viewMat', 'projectionMat', 'diffuse', 'lightmap']
                );
                
                depthPassShader = glUtil.createShaderProgram(gl, depthPassVS, depthPassFS,
                    ['position'],
                    ['viewMat', 'modelMat', 'projectionMat']
                );
                
                skyboxShader = glUtil.createShaderProgram(gl, skyVS, skyFS,
                    ['position'],
                    ['viewMat', 'projectionMat', 'diffuse']
                );
            }
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
                    this._loadMaterial(gl, texData, materialName);
                }
            }
        }
    },
    
    _loadMaterial: {
        value: function(gl, texData, materialName) {
            if(texData.material) { return; }
            materialManager.loadMaterial(gl, "root/tf/materials/", null, materialName, function(material) {
                texData.material = material;
            });
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
            
            // Render the skybox
            // TODO: This may be more efficient if I can do it last, so the Z culling kicks in
            gl.depthMask(0);
            gl.colorMask(1,1,1,1);
            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.BLEND);
            this._drawSkybox(gl, viewMat, projectionMat);
            
            if(this.DEPTH_PREPASS) {
                // Setup state for early-Z pass
                gl.depthMask(1);
                gl.colorMask(0,0,0,0);
                gl.depthFunc(gl.LESS);
                gl.enable(gl.DEPTH_TEST);
            
                // Do an early-Z pass on opaque geometry
                this._drawBrushes(gl, viewMat, projectionMat, frameCount, cullFrame, false, true);
                this._drawProps(gl, pos, viewMat, projectionMat, frameCount, cullFrame, false, true);
            
                // Turn off depth writes
                gl.depthMask(0);
                gl.colorMask(1,1,1,1);
                gl.depthFunc(gl.EQUAL);
            } else {
                gl.depthMask(1);
                gl.enable(gl.DEPTH_TEST);
                gl.depthFunc(gl.LEQUAL);
            }
            
            // Render opaque geometry
            var numSkippedBrushes = this._drawBrushes(gl, viewMat, projectionMat, frameCount, cullFrame, false);
            var numSkippedProps = this._drawProps(gl, pos, viewMat, projectionMat, frameCount, cullFrame, false);
            
            // Render translucent geometry
            gl.enable(gl.BLEND);
            gl.depthMask(1);
            gl.depthFunc(gl.LEQUAL);
            
            this._drawOverlays(gl, viewMat, projectionMat, frameCount, cullFrame);
            
            if(numSkippedBrushes > 0) {
                this._drawBrushes(gl, viewMat, projectionMat, frameCount, cullFrame, true);
            }
            
            if(numSkippedProps > 0) {
                this._drawProps(gl, pos, viewMat, projectionMat, frameCount, cullFrame, true);
            }
            
            // Draw our "light"
            //glUtil.drawCube(gl, pos, 128, [255, 255, 0, 255], viewMat, projectionMat);
        }
    },
    
    _drawBrushes: {
        value: function(gl, viewMat, projectionMat, frameCount, cullFrame, translucent, depthPass) {
            var shader = depthPass ? depthPassShader : sourceBspShader;
            var lastLightmap = null;
            var numSkippedSurfaces = 0;
            
            // Now we get down to the rendering loop
            gl.useProgram(shader);
            
            // Bind the appropriate buffers
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            
            // Enable vertex arrays
            gl.enableVertexAttribArray(shader.attribute.position);
            
            gl.uniformMatrix4fv(shader.uniform.projectionMat, false, projectionMat);
            gl.uniformMatrix4fv(shader.uniform.viewMat, false, viewMat);
            gl.uniformMatrix4fv(shader.uniform.modelMat, false, modelIdentityMat);
            
            gl.uniform1i(shader.uniform.diffuse, 0);
            gl.uniform1i(shader.uniform.lightmap, 1);
            
            if(!depthPass) {
                gl.enableVertexAttribArray(shader.attribute.texture);
                gl.enableVertexAttribArray(shader.attribute.light);
            
                gl.bindTexture(gl.TEXTURE_2D, this.defaultTexture);
                gl.uniform1i(shader.uniform.diffuse, 0);
            }
            
            // Loop through the locking groups
            for(var lockGroupId in this.lockGroups) {
                var lockGroup = this.lockGroups[lockGroupId];
            
                // Draw the mesh
                gl.vertexAttribPointer(shader.attribute.position, 3, gl.FLOAT, false, this.VERTEX_STRIDE, lockGroup.vertexOffset + 0);
                
                if(!depthPass) {
                    gl.vertexAttribPointer(shader.attribute.texture, 2, gl.FLOAT, false, this.VERTEX_STRIDE, lockGroup.vertexOffset + 12);
                    gl.vertexAttribPointer(shader.attribute.light, 2, gl.FLOAT, false, this.VERTEX_STRIDE, lockGroup.vertexOffset + 20);
                }
            
                // Loop through each triangle patch within the lock group and render them
                for(var triPatchId in lockGroup.triPatches) {
                    var triPatch = lockGroup.triPatches[triPatchId];
                    
                    // Displacement bit is a hack to get them to display until I can figure out
                    // how they are related to the BSP leaves
                    if(cullFrame && triPatch.renderFrame != frameCount && !triPatch.displacement) { continue; }
                    
                    if(triPatch.texData && triPatch.texData.material) {
                        var material = triPatch.texData.material;
                        if(material.translucent != translucent) { 
                            numSkippedSurfaces++; 
                            continue; 
                        }
                        material.setState(gl); // We need this even on the depth pass to manage front/back culling properly
                        texture = triPatch.texData.material.texture;
                    }
                    
                    if(!depthPass) {
                        var texture = null;
                        if(triPatch.texData && triPatch.texData.material) {
                            texture = triPatch.texData.material.texture;
                        }
                        if(!texture) {
                            texture = glUtil.defaultTexture;
                        }
                    
                        if(triPatch.lightmap !== lastLightmap) {
                            gl.activeTexture(gl.TEXTURE1);
                            gl.bindTexture(gl.TEXTURE_2D, triPatch.lightmap.texture);
                            lastLightmap = triPatch.lightmap;
                        }
                    
                        gl.activeTexture(gl.TEXTURE0);
                        gl.bindTexture(gl.TEXTURE_2D, texture);
                    }
                
                    gl.drawElements(gl.TRIANGLES, triPatch.indexCount, gl.UNSIGNED_SHORT, lockGroup.indexOffset + triPatch.indexOffset);
                }
            }
            
            return numSkippedSurfaces;
        }
    },    
    
    _drawProps: {
        value: function(gl, pos, viewMat, projectionMat, frameCount, cullFrame, translucent, depthPass) {
            if(!cullFrame || !this.propVertBuffer) { return 0; } // Don't render props when we step outside the world geometry.
            
            var shader = depthPass ? depthPassShader : sourceMdlShader;
            var numSkippedSurfaces = 0;
            
            //
            // Render static props
            //
            
            // Bind the common shader that they all use
            gl.useProgram(shader);
            
            // Bind the appropriate buffers
            gl.bindBuffer(gl.ARRAY_BUFFER, this.propVertBuffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.propIndexBuffer);
            
            gl.uniformMatrix4fv(shader.uniform.projectionMat, false, projectionMat);
            gl.uniformMatrix4fv(shader.uniform.viewMat, false, viewMat);

            // Enable vertex arrays
            gl.enableVertexAttribArray(shader.attribute.position);
            
            if(!depthPass) {
                gl.enableVertexAttribArray(shader.attribute.texture);
                gl.enableVertexAttribArray(shader.attribute.normal);
                gl.enableVertexAttribArray(shader.attribute.tangent);
            
                gl.uniform1i(shader.uniform.diffuse, 0);
                gl.uniform1i(shader.uniform.bump, 1);
                
                gl.uniform3f(shader.uniform.lightPos, pos[0], pos[1], pos[2]);
            }
            
            var vertexOffset, indexOffset;
            
            // Loop through all prop types
            for(var propDictId in this.staticPropDict) {
                var propDict = this.staticPropDict[propDictId];
                if(propDict.renderFrame != frameCount) { 
                    continue; // This prop type is not visible, skip
                } 
                var model = propDict.model;
                
                vertexOffset = model.vertexOffset;
                
                // Setup the vertex layout
                gl.vertexAttribPointer(shader.attribute.position, 3, gl.FLOAT, false, 64, vertexOffset + 16);
                gl.vertexAttribPointer(shader.attribute.normal, 3, gl.FLOAT, true, 64, vertexOffset + 28);
                gl.vertexAttribPointer(shader.attribute.texture, 2, gl.FLOAT, false, 64, vertexOffset + 40);
                gl.vertexAttribPointer(shader.attribute.tangent, 4, gl.FLOAT, false, 64, vertexOffset + 48);
                
                // For each prop type bind the material of each mesh once and then draw all instances of that mesh
                for(var meshId in model.meshes) {
                    var mesh = model.meshes[meshId];
                    var material = mesh.material;
                    
                    if(material && material.translucent != translucent) { 
                        numSkippedSurfaces++; 
                        continue; 
                    }
                    
                    // Bind the material for this mesh
                    material.setState(gl);
                    
                    if(!depthPass) {
                        var texture = material ? material.texture : null;
                        gl.activeTexture(gl.TEXTURE0);
                        gl.bindTexture(gl.TEXTURE_2D, texture || glUtil.defaultTexture);
                        
                        var bump = material ? material.bump : null;
                        gl.activeTexture(gl.TEXTURE1);
                        gl.bindTexture(gl.TEXTURE_2D, bump || glUtil.defaultBumpTexture);
                    }
                    
                    // Loop through all visible instances of this prop and draw them
                    // NOTE: This, this right here, is a perfect reason for wanting instancing!!!
                    for(var propId in propDict.props) {
                        var prop = propDict.props[propId];
                        if(prop.renderFrame != frameCount) { continue; } // This prop instance is not visible, skip
                        
                        /*if(!depthPass) {
                            gl.uniform3f(shader.uniform.lightPos, prop.m_LightingOrigin.x, prop.m_LightingOrigin.y, prop.m_LightingOrigin.z);
                        }*/
                        
                        gl.uniformMatrix4fv(shader.uniform.modelMat, false, prop.modelMat);
                        
                        /*mat4.multiply(viewMat, prop.modelMat, modelViewMat);
                        mat4.toInverseMat3(modelViewMat, modelViewInvMat);
                        gl.uniformMatrix3fv(shader.uniform.normalMat, false, modelViewInvMat);*/
                        
                        for(var triPatchId in mesh.triPatches) {
                            var triPatch = mesh.triPatches[triPatchId];
                            gl.drawElements(gl.TRIANGLES, triPatch.numIndices, gl.UNSIGNED_SHORT, model.indexOffset + triPatch.indexOffset);
                        }
                    }
                }
            }
            
            return numSkippedSurfaces;
        }
    },
    
    _drawOverlays: {
        value: function(gl, viewMat, projectionMat, frameCount, cullFrame) {
            
        }
    },
    
    _drawSkybox: {
        value: function(gl, viewMat, projectionMat) {
            var shader = skyboxShader;
            if(!this.skyboxCubemap || !shader) { return; }
            gl.enable(gl.TEXTURE_CUBE_MAP);
            
            gl.disable(gl.CULL_FACE);
            
            // Bind the common shader that they all use
            gl.useProgram(shader);
            
            // Bind the buffers
            gl.bindBuffer(gl.ARRAY_BUFFER, this.skyboxVertBuffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.skyboxIndexBuffer);
            
            // Set uniforms
            gl.uniformMatrix4fv(shader.uniform.viewMat, false, viewMat);
            gl.uniformMatrix4fv(shader.uniform.projectionMat, false, projectionMat);
            gl.uniform1i(shader.uniform.diffuse, 0);
            
            gl.enableVertexAttribArray(shader.attribute.position);
            gl.vertexAttribPointer(shader.attribute.position, 3, gl.FLOAT, false, 12, 0);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.skyboxCubemap);
            
            gl.drawElements(gl.TRIANGLES, this.skyboxIndexCount, gl.UNSIGNED_SHORT, 0);
            
            gl.disable(gl.TEXTURE_CUBE_MAP);
            
            gl.enable(gl.CULL_FACE);
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
                        
                        this.staticPropDict[prop.m_PropType].renderFrame = frame;
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
