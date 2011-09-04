/*
 * Valve Source Engine model rendering
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

/*
 * Shaders
 */

// Vertex Shader
var meshVS = "attribute vec3 position;\n";
meshVS += "attribute vec2 texCoord;\n";
meshVS += "attribute vec3 normal;\n";
meshVS += "attribute vec3 tangent;\n";

meshVS += "uniform mat4 viewMat;\n";
meshVS += "uniform mat4 modelMat;\n";
meshVS += "uniform mat4 projectionMat;\n";

meshVS += "varying vec3 vNormal;\n";

meshVS += "void main(void) {\n";
meshVS += " mat4 mModelView = viewMat * modelMat;\n";
meshVS += " vec4 vPosition = mModelView * vec4(position, 1.0);\n";
meshVS += " gl_Position = projectionMat * vPosition;\n";

meshVS += "	vNormal = normalize(normal);\n";
meshVS += "}";

// Fragment Shader
var meshFS = "";
meshFS += "varying vec3 vNormal;\n";

meshFS += "void main(void) {\n";
meshFS += " vec3 lightColor = vec3(1.0, 1.0, 1.0);\n"
meshFS += " vec3 lightDir = vec3(1.0, 1.0, 1.0);\n"
meshFS += "	vec3 normal = normalize(vNormal);\n";

meshFS += "	float lightFactor = max(dot(lightDir, normal), 0.0);\n";
meshFS += "	vec3 lightValue = vec3(0.05, 0.05, 0.05) + (lightColor * lightFactor);\n";
meshFS += " gl_FragColor = vec4(lightValue, 1.0);\n";
meshFS += "}";

//============
// Constants
//============

var MAX_NUM_LODS = 8;
var MAX_NUM_BONES_PER_VERT = 3;
var MAX_NUM_BONES_PER_TRI = 9;
var VERTEX_STRIDE = 64;

//=============
// MDL Structs
// ref: public/studio.h
//=============

var Vector2D = Struct.create(
    Struct.float32("x"),
    Struct.float32("y"),
    Struct.float32("z")
);

var Vector = Struct.create(
    Struct.float32("x"),
    Struct.float32("y"),
    Struct.float32("z")
);

var Vector4D = Struct.create(
    Struct.float32("x"),
    Struct.float32("y"),
    Struct.float32("z"),
    Struct.float32("w")
);

var MStudio_MeshVertexData_t = Struct.create(
    Struct.skip(4),
    Struct.array("numLODVertexes", Struct.int32(), MAX_NUM_LODS)
);

var MStudioMesh_t = Struct.create(
	Struct.int32("material"),
	Struct.int32("modelindex"),
	Struct.int32("numvertices"), Struct.int32("vertexoffset"),
	Struct.int32("numflexes"), Struct.int32("flexindex"),
	Struct.int32("materialtype"),
	Struct.int32("materialparam"),
	Struct.int32("meshid"),
	Struct.struct("center", Vector),
    Struct.struct("vertexdata", MStudio_MeshVertexData_t),
	Struct.skip(32)
);

var MStudioModel_t = Struct.create(
	Struct.string("name", 64),
	Struct.int32("type"),
	Struct.float32("boundingradius"), 
	Struct.int32("nummeshes"), Struct.int32("meshindex"),
	Struct.int32("numvertices"), Struct.int32("vertexindex"), Struct.int32("tangentsindex"),
	Struct.int32("numattachments"), Struct.int32("attachmentindex"),
	Struct.int32("numeyeballs"), Struct.int32("eyeballindex"),
	Struct.skip(40)
);

var MStudioBodyParts_t = Struct.create(
    Struct.int32("sznameindex"),
    Struct.int32("nummodels"),
    Struct.int32("base"),
    Struct.int32("modelindex")
);

var MStudioTexture_t = Struct.create(
    Struct.int32("sznameindex"),
    Struct.int32("flags"),
    Struct.int32("used"),
    Struct.skip(52)
);

var StudioHdr_t = Struct.create( // This is the header for the MDL file (AKA: The giant header of DOOOOOOOOM!!)
    Struct.int32("id"),
    Struct.int32("version"),
    Struct.int32("checksum"),
    Struct.string("name", 64),
    Struct.int32("length"),
    Struct.struct("eyeposition", Vector),
    Struct.struct("illumposition", Vector),
    Struct.struct("hull_min", Vector), Struct.struct("hull_max", Vector),
    Struct.struct("view_bbmin", Vector), Struct.struct("view_bbmax", Vector),
    Struct.int32("flags"),
    Struct.int32("numbones"), Struct.int32("boneindex"),
    Struct.int32("numbonecontrollers"), Struct.int32("bonecontrollerindex"),
    Struct.int32("numhitboxsets"), Struct.int32("hitboxsetindex"),
    Struct.int32("numlocalanim"), Struct.int32("localanimindex"),
    Struct.int32("numlocalseq"), Struct.int32("localseqindex"),
    Struct.int32("activitylistversion"),
    Struct.int32("eventsindexed"),
    Struct.int32("numtextures"), Struct.int32("textureindex"),
    Struct.int32("numcdtextures"), Struct.int32("cdtextureindex"),
    Struct.int32("numskinref"),
    Struct.int32("numskinfamilies"), Struct.int32("skinindex"),
    Struct.int32("numbodyparts"), Struct.int32("bodypartindex"),
    Struct.int32("numlocalattachments"), Struct.int32("localattachmentindex"),
    Struct.int32("numlocalnodes"), Struct.int32("localnodeindex"),
    Struct.int32("localnodenameindex"),
    Struct.int32("numflexdesc"), Struct.int32("flexdescindex"),
    Struct.int32("numflexcontrollers"), Struct.int32("flexcontrollerindex"),
    Struct.int32("numflexrules"), Struct.int32("flexruleindex"),
    Struct.int32("numikchains"), Struct.int32("ikchainindex"),
    Struct.int32("nummouths"), Struct.int32("mouthindex"),
    Struct.int32("numlocalposeparameters"), Struct.int32("localposeparamindex"),
    Struct.int32("surfacepropindex"),
    Struct.int32("keyvalueindex"), Struct.int32("keyvaluesize"),
    Struct.int32("numlocalikautoplaylocks"), Struct.int32("localikautoplaylockindex"),
    Struct.float32("mass"),
    Struct.int32("contents"),
    Struct.int32("numincludemodels"), Struct.int32("includemodelindex"),
    Struct.skip(4), //virtualModel
    Struct.int32("szanimblocknameindex"),
    Struct.int32("numanimblocks"), Struct.int32("animblockindex"),
    Struct.skip(4), //animblockModel
    Struct.int32("bonetablebynameindex"),
    Struct.skip(8), // pVertexBase, pIndexBase
    Struct.int8("constdirectionallightdot"),
    Struct.int8("rootLOD"), Struct.int8("numAllowedRootLODs"),
    Struct.skip(5), // unused
    Struct.int32("numflexcontrollerui"), Struct.int32("flexcontrolleruiindex"),
    Struct.skip(8), // unused
    Struct.int32("studiohdr2index"),
    Struct.skip(4) // unused
);

// Structs



//=============
// VVD Structs
// ref: public/studio.h
//=============

var VertexFileHeader_t = Struct.create(
    Struct.int32("id"), // MODEL_VERTEX_FILE_ID
    Struct.int32("version"), // MODEL_VERTEX_FILE_VERSION
    Struct.int32("checksum"), // same as studiohdr_t, ensures sync
    Struct.int32("numLODs"), // num of valid lods
    Struct.array("numLODVertexes", Struct.int32(), MAX_NUM_LODS), // num verts for desired root lod
    Struct.int32("numFixups"), // num of vertexFileFixup_t
    Struct.int32("fixupTableStart"), // offset from base to fixup table
    Struct.int32("vertexDataStart"), // offset from base to vertex block
    Struct.int32("tangentDataStart") // offset from base to tangent block
);

//=============
// VTX Structs
// ref: public/optimize.h
//=============

var BoneStateChangeHeader_t = Struct.create(
    Struct.int32("hardwareID"),
    Struct.int32("newBoneID")
);

var Vertex_t = Struct.create(
    Struct.array("boneWeightIndex", Struct.uint8(), MAX_NUM_BONES_PER_VERT),
    Struct.uint8("numBones"),
    Struct.uint16("origMeshVertID"),
    Struct.array("boneID", Struct.uint8(), MAX_NUM_BONES_PER_VERT)
);

var StripHeader_t = Struct.create(
    Struct.int32("numIndices"),
    Struct.int32("indexOffset"),
    Struct.int32("numVerts"),
    Struct.int32("vertOffset"),
    Struct.int16("numBones"),
    Struct.uint8("flags"),
    Struct.int32("numBoneStateChanges"),
    Struct.int32("boneStateChangeOffset")
);

var StripGroupHeader_t = Struct.create(
    Struct.int32("numVerts"),
    Struct.int32("vertOffset"),
    Struct.int32("numIndices"),
    Struct.int32("indexOffset"),
    Struct.int32("numStrips"),
    Struct.int32("stripOffset"),
    Struct.uint8("flags")
);

var MeshHeader_t = Struct.create(
    Struct.int32("numStripGroups"),
    Struct.int32("stripGroupHeaderOffset"),
    Struct.uint8("flags")
);

var ModelLODHeader_t = Struct.create(
    Struct.int32("numMeshes"),
    Struct.int32("meshOffset"),
    Struct.float32("switchPoint")
);

var ModelHeader_t = Struct.create(
    Struct.int32("numLODs"),
    Struct.int32("lodOffset")
);

var BodyPartHeader_t = Struct.create(
    Struct.int32("numModels"),
    Struct.int32("modelOffset")
);

var MaterialReplacementHeader_t = Struct.create(
    Struct.int16("materialID"),
    Struct.int32("replacementMaterialNameOffset")
);

var MaterialReplacementListHeader_t = Struct.create(
    Struct.int16("numReplacements"),
    Struct.int32("replacementOffset")
);

var MaterialReplacementListHeader_t = Struct.create(
    Struct.int16("numReplacements"),
    Struct.int32("replacementOffset")
);

var VtxHeader_t = Struct.create( // Listed in optimize.h as FileHeader_t
    Struct.int32("version"),
    Struct.int32("vertCacheSize"),
    Struct.int16("maxBonesPerStrip"),
    Struct.int16("maxBonesPerTri"),
    Struct.int32("maxBonesPerVert"),
    Struct.int32("checkSum"),
    Struct.int32("numLODs"),
    Struct.int32("materialReplacementListOffset"),
    Struct.int32("numBodyParts"),
    Struct.int32("bodyPartOffset")
);

var SourceModel = Object.create(Object, {
    lod: {
        value: 7
    },
    
    vertArray: {
        value: null
    },
    
    indexArray: {
        value: null
    },
    
    vertBuffer: {
        value: null
    },
    
    indexBuffer: {
        value: null
    },
    
    bodyParts: {
        value: null
    },
    
    mdlBodyParts: {
        value: null
    },
    
    shader: {
        value: null
    },
    
    vertexIndex: {
        value: 0
    },
    
    load: {
        value: function(gl, url) {
            this._initializeShaders(gl);
            
            url = url.replace(".mdl", "");
            
            var self = this;
            
            var mdlXhr = new XMLHttpRequest();
            mdlXhr.open('GET', url + ".mdl", true);
            mdlXhr.responseType = "arraybuffer";
            mdlXhr.addEventListener("load", function() {
                self._parseMdl(this.response);
                
                var vvdXhr = new XMLHttpRequest();
                vvdXhr.open('GET', url + ".vvd", true);
                vvdXhr.responseType = "arraybuffer";
                vvdXhr.addEventListener("load", function() {
                    self._parseVvd(this.response, self.lod);
                    self._initializeVertexBuffer(gl);
                
                    var vtxXhr = new XMLHttpRequest();
                    vtxXhr.open('GET', url + ".dx90.vtx", true);
                    vtxXhr.responseType = "arraybuffer";
                    vtxXhr.addEventListener("load", function() {
                        self._parseVtx(this.response, self.lod);
                        self._initializeBuffers(gl);
                    });
                    vtxXhr.send(null);
                
                });
                vvdXhr.send(null);
            
            });
            mdlXhr.send(null);

            return this;
        }
    },
    
    _initializeShaders: {
        value: function(gl) {
            this.shader = glUtil.createShaderProgram(gl, meshVS, meshFS,
                ['position', 'texCoord', 'normal', 'tangent'],
                ['viewMat', 'modelMat', 'projectionMat']
            );
        }
    },
    
    /*
     * MDL File Handling
     */
     
    _parseMdl: {
        value: function(buffer) {
            var header = StudioHdr_t.readStructs(buffer, 0, 1)[0];
            
            var textures = MStudioTexture_t.readStructs(buffer, header.textureindex, header.numtextures, function(bodyPart, offset) {
                
            });
            
            this.mdlBodyParts = MStudioBodyParts_t.readStructs(buffer, header.bodypartindex, header.numbodyparts, function(bodyPart, offset) {
                bodyPart.models = MStudioModel_t.readStructs(buffer, bodyPart.modelindex + offset, bodyPart.nummodels, function(model, offset) {
                    model.meshes = MStudioMesh_t.readStructs(buffer, model.meshindex + offset, model.nummeshes, function(model, offset) {
                        
                    });
                });
            });
            
            this._setRootLOD(this.mdlBodyParts, this.lod);
        }
    },
    
    _setRootLOD: {
        value: function(bodyParts, lod) {
            var vertexindex = 0;
        
            for(var bodyPartId = 0; bodyPartId < bodyParts.length; ++bodyPartId) {
                var bodyPart = bodyParts[bodyPartId];
                
                for(var modelId = 0; modelId < bodyPart.models.length; ++modelId) {
                    var model = bodyPart.models[modelId];
                    
                    var totalMeshVertices = 0;                  
                    for(var meshId = 0; meshId < model.meshes.length; ++meshId) {
                        var mesh = model.meshes[modelId];
                        
                        mesh.numvertices = mesh.vertexdata.numLODVertexes[lod];
                        mesh.vertexoffset = totalMeshVertices;
                        totalMeshVertices += mesh.numvertices;
                    }
                    
                    model.numvertices = totalMeshVertices;
                    model.vertexindex = vertexindex;
                    vertexindex += totalMeshVertices*VERTEX_STRIDE;
                }
            }
        }
    },
    
    /*
     * VVD File Handling
     */
    
    _parseVvd: {
        value: function(buffer, lod) {
            var header = VertexFileHeader_t.readStructs(buffer, 0, 1)[0];
            
            if(lod >= header.numLODs) {
                lod = this.lod = header.numLODs-1;
            }
            
            this.vertCount = header.numLODVertexes[lod];
            this.vertArray = this._parseFixup(buffer, lod, header.fixupTableStart, header.numFixups, header.vertexDataStart, header.tangentDataStart); 
        }
    },
    
    _parseFixup: {
        value: function(buffer, lod, fixupOffset, fixupCount, vertexOffset, tangentOffset) {
            var fixupView = new DataView(buffer, fixupOffset);
            var vertexView = new Uint8Array(buffer, vertexOffset);
            var tangentView = new Uint8Array(buffer, tangentOffset);
            
            // This is a byte array because the GPU doesn't care about type and it allows us to sidestype byte-alignment issues
            var vertexArray = new Uint8Array(this.vertCount * 64);
            var vertexArrayOffset = 0;
            
            for(var i = 0; i < fixupCount; ++i) {
                var fixupViewOffset = i*12;
                var fixupLod = fixupView.getUint32(fixupViewOffset, true);
                
                if(fixupLod >= lod) {
                    var sourceVertexID = fixupView.getUint32(fixupViewOffset+4, true);
                    var numVertexes = fixupView.getUint32(fixupViewOffset+8, true);
                    
                    for(var j = 0; j < numVertexes; ++j) {
                        var vertexViewOffset = (sourceVertexID+j)*48;
                        var tangentViewOffset = (sourceVertexID+j)*16;
                        
                        // vertex (48 bytes)
                        vertexArray.set(vertexView.subarray(vertexViewOffset, vertexViewOffset+48), vertexArrayOffset);
                        // tangent (16 bytes)
                        vertexArray.set(tangentView.subarray(tangentViewOffset, tangentViewOffset+16), vertexArrayOffset+48);
                        vertexArrayOffset += VERTEX_STRIDE;
                    }
                }
            }
            
            return vertexArray;
        }
    },
    
    _initializeVertexBuffer: {
        value: function(gl) {
            this.vertBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.vertArray, gl.STATIC_DRAW);
        }
    },
    
    /*
     * VTX File Handling
     */ 
    
    _parseVtx: {
        value: function(buffer) {
            var header = VtxHeader_t.readStructs(buffer, 0, 1)[0];
            
            // Nested struct parsing loop of DOOM!
            
            this.bodyParts = BodyPartHeader_t.readStructs(buffer, header.bodyPartOffset, header.numBodyParts, function(bodyPart, offset) {
                bodyPart.models = ModelHeader_t.readStructs(buffer, offset + bodyPart.modelOffset, bodyPart.numModels, function(model, offset) {
                    model.lods = ModelLODHeader_t.readStructs(buffer, offset + model.lodOffset, model.numLODs, function(lod, offset) {
                        lod.meshes = MeshHeader_t.readStructs(buffer, offset + lod.meshOffset, lod.numMeshes, function(mesh, offset) {
                            mesh.stripGroups = StripGroupHeader_t.readStructs(buffer, offset + mesh.stripGroupHeaderOffset, mesh.numStripGroups, function(stripGroup, offset) {
                                stripGroup.verts = Vertex_t.readStructs(buffer, offset + stripGroup.vertOffset, stripGroup.numVerts);
                                stripGroup.strips = StripHeader_t.readStructs(buffer, offset + stripGroup.stripOffset, stripGroup.numStrips);
                                stripGroup.indexArray = new Uint8Array(buffer, offset + stripGroup.indexOffset, stripGroup.numIndices*2);
                            });
                        });
                    });
                });
            });
        }
    },
    
    _buildVertexArray: {
        value: function(vertTable, offset) {
            var array = new Uint8Array(vertTable.length * VERTEX_STRIDE);
            var verts = this.vertArray;
            
            var arrayOffset = 0;
            for(var i = 0; i < vertTable.length; ++i) {
                var vertsOffset = offset + ((vertTable[i].origMeshVertID) * VERTEX_STRIDE);
                array.set(verts.subarray(vertsOffset, vertsOffset+VERTEX_STRIDE), arrayOffset);
                arrayOffset += VERTEX_STRIDE;
            }
            
            return array;
        }
    },
    
    _initializeBuffers: {
        value: function(gl) {
            var self = this;
            this._iterateStripGroups(function(stripGroup, mesh, model, bodyPart) {
                var vertArray = self._buildVertexArray(stripGroup.verts, model.vertexindex);
                
                stripGroup.vertBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, stripGroup.vertBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, vertArray, gl.STATIC_DRAW);
                     
                stripGroup.indexBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, stripGroup.indexBuffer);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, stripGroup.indexArray, gl.STATIC_DRAW);
            }, this.lod);
        }
    },
    
    _iterateStripGroups: {
        value: function(callback, lodId) {
            // Okay, this is just silly! Sooo many nested structures!
            
            for(var bodyPartId in this.bodyParts) {
                var bodyPart = this.bodyParts[bodyPartId];
                var mdlBodyPart = this.mdlBodyParts[bodyPartId];
                
                for(var modelId in bodyPart.models) {
                    var model = bodyPart.models[modelId];
                    var mdlModel = mdlBodyPart.models[modelId];
                    
                    if(typeof(lodId) !== 'undefined') {
                        var lod = model.lods[lodId];
                        
                        for(var meshId in lod.meshes) {
                            var mesh = lod.meshes[meshId];
                            var mdlMesh = mdlModel.meshes[meshId];
                            
                            for(var stripGroupId in mesh.stripGroups) {
                                var stripGroup = mesh.stripGroups[stripGroupId];
                                
                                if(callback(stripGroup, mdlMesh, mdlModel, mdlBodyPart) === false) {
                                    return;
                                }
                            }
                        }
                    } else {
                        for(var lodIterId in model.lods) {
                            var lod = model.lods[lodIterId];

                            for(var meshId in lod.meshes) {
                                var mesh = lod.meshes[meshId];
                                var mdlMesh = mdlModel.meshes[meshId];

                                for(var stripGroupId in mesh.stripGroups) {
                                    var stripGroup = mesh.stripGroups[stripGroupId];
                                    
                                    if(callback(stripGroup, mdlMesh, mdlModel, mdlBodyPart) === false) {
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    
    /*
     * Rendering
     */
    
    draw: {
        value: function(gl, viewMat, projectionMat, modelMat) {
            var shader = this.shader;
            
            if(!shader || !this.vertBuffer) { return; }
            
            gl.useProgram(shader);
            
            gl.uniformMatrix4fv(shader.uniform.projectionMat, false, projectionMat);
            gl.uniformMatrix4fv(shader.uniform.viewMat, false, viewMat);
            gl.uniformMatrix4fv(shader.uniform.modelMat, false, modelMat);

            // Enable vertex arrays
            gl.enableVertexAttribArray(shader.attribute.position);
            gl.enableVertexAttribArray(shader.attribute.texCoord);
            gl.enableVertexAttribArray(shader.attribute.normal);
            gl.enableVertexAttribArray(shader.attribute.tangent);
            
            // Bind the appropriate buffers
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuffer);

            // Draw the mesh
            gl.vertexAttribPointer(shader.attribute.position, 3, gl.FLOAT, false, VERTEX_STRIDE, 16);
            gl.vertexAttribPointer(shader.attribute.normal, 3, gl.FLOAT, true, VERTEX_STRIDE, 28);
            gl.vertexAttribPointer(shader.attribute.texCoord, 2, gl.FLOAT, false, VERTEX_STRIDE, 40);
            gl.vertexAttribPointer(shader.attribute.tangent, 4, gl.FLOAT, false, VERTEX_STRIDE, 48);
            
            gl.drawArrays(gl.POINTS, 0, this.vertCount);
            
            /*this._iterateStripGroups(function(stripGroup, mesh, model, bodyPart) {
                // Bind the appropriate buffers
                gl.bindBuffer(gl.ARRAY_BUFFER, stripGroup.vertBuffer);      
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, stripGroup.indexBuffer);
                
                for(var stripId in stripGroup.strips) {
                    var strip = stripGroup.strips[stripId];
                    var vertexOffset = strip.vertOffset * VERTEX_STRIDE;
                    
                    // Draw the triangle strip
                    gl.vertexAttribPointer(shader.attribute.position, 3, gl.FLOAT, false, VERTEX_STRIDE, vertexOffset + 16);
                    gl.vertexAttribPointer(shader.attribute.normal, 3, gl.FLOAT, true, VERTEX_STRIDE, vertexOffset + 28);
                    gl.vertexAttribPointer(shader.attribute.texCoord, 2, gl.FLOAT, false, VERTEX_STRIDE, vertexOffset + 40);
                    gl.vertexAttribPointer(shader.attribute.tangent, 4, gl.FLOAT, false, VERTEX_STRIDE, vertexOffset + 48);
                    
                    //gl.drawArrays(gl.POINTS, 0, strip.numVerts);

                    gl.drawElements(gl.TRIANGLES, strip.numIndices, gl.UNSIGNED_SHORT, strip.indexOffset * 2);
                }
                
                return false;
            }, this.lod);*/
        }
    }
});