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
meshVS += "attribute vec2 texture;\n";
meshVS += "attribute vec3 normal;\n";
meshVS += "attribute vec4 tangent;\n";

meshVS += "uniform mat4 viewMat;\n";
meshVS += "uniform mat4 modelMat;\n";
meshVS += "uniform mat3 normalMat;\n";
meshVS += "uniform mat4 projectionMat;\n";

meshVS += "uniform vec3 lightPos;\n";

meshVS += "varying vec2 vTexCoord;\n";
meshVS += "varying vec3 tangentLightDir;\n";
meshVS += "varying vec3 tangentEyeDir;\n";

meshVS += "void main(void) {\n";
meshVS += " mat4 modelViewMat = viewMat * modelMat;\n";
meshVS += " vec4 vPosition = modelViewMat * vec4(position, 1.0);\n";
meshVS += " gl_Position = projectionMat * vPosition;\n";

meshVS += " vTexCoord = texture;\n";

meshVS += " vec3 n = normalize(normal * normalMat);\n";
meshVS += " vec3 t = normalize(tangent.xyz * normalMat);\n";
meshVS += " vec3 b = cross (n, t) * tangent.w;\n";

meshVS += " vec3 vlightPos = (viewMat * vec4(lightPos, 1.0)).xyz;\n";
meshVS += " vec3 lightDir = vlightPos - vPosition.xyz;\n";
meshVS += " tangentLightDir.x = dot(lightDir, t);\n";
meshVS += " tangentLightDir.y = dot(lightDir, b);\n";
meshVS += " tangentLightDir.z = dot(lightDir, n);\n";

meshVS += " vec3 eyeDir = normalize(-vPosition.xyz);\n";
meshVS += " tangentEyeDir.x = dot(eyeDir, t);\n";
meshVS += " tangentEyeDir.y = dot(eyeDir, b);\n";
meshVS += " tangentEyeDir.z = dot(eyeDir, n);\n";

meshVS += "}";

// Fragment Shader
var meshFS = "uniform sampler2D diffuse;\n";
meshFS += "uniform sampler2D bump;\n";

meshFS += "varying vec2 vTexCoord;\n";
meshFS += "varying vec3 tangentLightDir;\n";
meshFS += "varying vec3 tangentEyeDir;\n";

meshFS += "void main(void) {\n";
meshFS += " vec3 lightColor = vec3(1.0, 1.0, 1.0);\n";
meshFS += " vec3 specularColor = vec3(1.0, 1.0, 1.0);\n";
meshFS += " float shininess = 8.0;\n";
meshFS += " vec3 ambientLight = vec3(0.15, 0.15, 0.15);\n"; 

meshFS += " vec3 lightDir = normalize(tangentLightDir);\n"
meshFS += " vec3 normal = normalize(2.0 * (texture2D(bump, vTexCoord.st).rgb - 0.5));\n"
meshFS += " vec4 diffuseColor = texture2D(diffuse, vTexCoord.st);\n";

meshFS += " vec3 eyeDir = normalize(tangentEyeDir);\n"
meshFS += " vec3 reflectDir = reflect(-lightDir, normal);\n"
meshFS += " float specularFactor = pow(clamp(dot(reflectDir, eyeDir), 0.0, 1.0), shininess) * 1.0; // Specular Level\n"

meshFS += " float lightFactor = max(dot(lightDir, normal), 0.0);\n";
meshFS += " vec3 lightValue = ambientLight + (lightColor * lightFactor) + (specularColor * specularFactor);\n";
meshFS += " gl_FragColor = vec4(diffuseColor.rgb * lightValue, diffuseColor.a);\n";
meshFS += "}";

var sourceMdlShader = null;

var modelIdentityMat = mat4.create();
mat4.identity(modelIdentityMat);

var modelViewMat = mat4.create();
var modelViewInvMat = mat3.create();

var SourceModel = Object.create(Object, {
    lod: {
        value: 1 // -1 will select the lowest level of detail available. 0 the highest
    },
    
    vertArray: {
        value: null
    },
    
    vertBuffer: {
        value: null
    },
    
    indexArray: {
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
    
    vertexIndex: {
        value: 0
    },
    
    textures: {
        value: null
    },
    
    textureDirs: {
        value: null
    },
    
    numSkinRef: {
        value: 0
    },
    
    skinTable: {
        value: null
    },
    
    skin: {
        value: 0
    },
    
    /**
     * Load the .mdl and other associated files.
     * @param gl WebGL context used to initialize the data. If not provided, the model will parse all relevent data but will not upload to the GPU
     * @param url Location to load the model from. Do not pass an extension. Will load url.mdl, url.vvd, and url.vtx
     * @param callback Function to call when load is complete
     **/
    load: {
        value: function(gl, url, callback) {
            if(gl) {
                this.initializeShaders(gl);
            }
            
            url = url.replace(".mdl", ""); // Strip off .mdl extension if it was provided
            
            var self = this;
            
            var mdlXhr = new XMLHttpRequest();
            mdlXhr.open('GET', url + ".mdl", true);
            mdlXhr.responseType = "arraybuffer";
            mdlXhr.addEventListener("load", function() {
                self._parseMdl(this.response);
                
                if(gl) {
                    self.loadSkin(gl, 0);
                }
                
                var vvdXhr = new XMLHttpRequest();
                vvdXhr.open('GET', url + ".vvd", true);
                vvdXhr.responseType = "arraybuffer";
                vvdXhr.addEventListener("load", function() {
                    self._parseVvd(this.response, self.lod);
                
                    var vtxXhr = new XMLHttpRequest();
                    vtxXhr.open('GET', url + ".dx90.vtx", true);
                    vtxXhr.responseType = "arraybuffer";
                    vtxXhr.addEventListener("load", function() {
                        self._parseVtx(this.response, self.lod);
                        
                        if(gl) {
                            self._initializeBuffers(gl);
                        }
                        
                        if(callback) { callback(self); }
                    });
                    vtxXhr.send(null);
                
                });
                vvdXhr.send(null);
            
            });
            mdlXhr.send(null);

            return this;
        }
    },
    
    loadSkin: {
        value: function(gl, skinId) {
            this.skin = skinId;
            
            // Load Materials
            var skinTableOffset = this.numSkinRef * skinId;
            for(var i = 0; i < this.numSkinRef; ++i) {
                var textureId = this.skinTable[skinTableOffset + i];
                var texture = this.textures[textureId];
                if(!texture.material) {
                    this._loadMaterial(gl, texture);
                }
            }
        }
    },
    
    _loadMaterial: {
        value: function(gl, texture) {
            var materialName = texture.textureName;
            materialManager.loadMaterial(gl, "root/tf/materials/", this.textureDirs, materialName, function(material) {
                texture.material = material;
            });
        }
    },
    
    initializeShaders: {
        value: function(gl) {
            if(!sourceMdlShader) {
                sourceMdlShader = glUtil.createShaderProgram(gl, meshVS, meshFS,
                    ['position', 'texture', 'normal', 'tangent'],
                    ['modelMat', 'viewMat', 'projectionMat', 'normalMat', 'diffuse', 'bump', 'lightPos']
                );
            }
        }
    },
    
    /*
     * MDL File Handling
     */
     
    _parseMdl: {
        value: function(buffer) {
            var header = StudioHdr_t.readStructs(buffer, 0, 1)[0];
            
            // Texture names
            this.textures = MStudioTexture_t.readStructs(buffer, header.textureindex, header.numtextures, function(texture, offset) {
                texture.readTextureName(buffer, offset);
            });
            
            // Texture directories
            var textureDirs = this.textureDirs = [];
            MStudioTextureDir_t.readStructs(buffer, header.cdtextureindex, header.numcdtextures, function(textureDir, offset) {
                textureDir.readTextureDir(buffer, 0);
                textureDirs.push(textureDir.textureDir);
            });
            
            // Skin Table
            var skinTableSize = header.numskinref * header.numskinfamilies;
            this.numSkinRef = header.numskinref;
            this.skinTable = Struct.readUint16Array(buffer, header.skinindex, skinTableSize);
            
            // Mesh definitions
            this.mdlBodyParts = MStudioBodyParts_t.readStructs(buffer, header.bodypartindex, header.numbodyparts, function(bodyPart, offset) {
                bodyPart.models = MStudioModel_t.readStructs(buffer, bodyPart.modelindex + offset, bodyPart.nummodels, function(model, offset) {
                    model.meshes = MStudioMesh_t.readStructs(buffer, model.meshindex + offset, model.nummeshes, function(mesh, offset) {
                        
                    });
                });
            });
            
            // Calculate mesh offsets
            this._setRootLOD(header, this.mdlBodyParts, this.lod);
        }
    },
    
    _setRootLOD: {
        value: function(header, bodyParts, rootLOD) {
            
            if(header.numAllowedRootLODs > 0 && rootLOD >= header.numAllowedRootLODs)
            {
                rootLOD = header.numAllowedRootLODs - 1;
            }
            
            var vertexoffset = 0;
        
            for(var bodyPartId = 0; bodyPartId < bodyParts.length; ++bodyPartId) {
                var bodyPart = bodyParts[bodyPartId];
                
                for(var modelId = 0; modelId < bodyPart.models.length; ++modelId) {
                    var model = bodyPart.models[modelId];
                    
                    var totalMeshVertices = 0;                  
                    for(var meshId = 0; meshId < model.meshes.length; ++meshId) {
                        var mesh = model.meshes[meshId];
                        
                        mesh.numvertices = mesh.vertexdata.numLODVertexes[rootLOD];
                        mesh.vertexoffset = totalMeshVertices;
                        totalMeshVertices += mesh.numvertices;
                    }
                    
                    model.numvertices = totalMeshVertices;
                    model.vertexoffset = vertexoffset;
                    vertexoffset += totalMeshVertices;
                }
            }
            
            this.lod = rootLOD;
        }
    },
    
    /*
     * VVD File Handling
     */
    
    _parseVvd: {
        value: function(buffer) {
            var header = VertexFileHeader_t.readStructs(buffer, 0, 1)[0];
            
            if(this.lod >= header.numLODs || this.lod == -1) {
                this.lod = header.numLODs-1;
            }
            
            this.vertCount = header.numLODVertexes[this.lod];
            this.vertArray = this._parseFixup(buffer, this.lod, header.fixupTableStart, header.numFixups, header.vertexDataStart, header.tangentDataStart); 
        }
    },
    
    _parseFixup: {
        value: function(buffer, lod, fixupOffset, fixupCount, vertexOffset, tangentOffset) {
            var fixupView = new DataView(buffer, fixupOffset);
            var vertexView = new Uint8Array(buffer, vertexOffset);
            var tangentView = new Uint8Array(buffer, tangentOffset);
            
            // This is a byte array because the GPU doesn't care about type and it allows us to sidestep byte-alignment issues
            var vertexArray = new Uint8Array(this.vertCount * 64);
            var vertexArrayOffset = 0;
            
            if(fixupCount == 0) {
                // With no fixups, we pull in all the vertices
                for(var j = 0; j < this.vertCount; ++j) {
                    var vertexViewOffset = j*48;
                    var tangentViewOffset = j*16;
                
                    // vertex (48 bytes)
                    vertexArray.set(vertexView.subarray(vertexViewOffset, vertexViewOffset+48), vertexArrayOffset);
                    // tangent (16 bytes)
                    vertexArray.set(tangentView.subarray(tangentViewOffset, tangentViewOffset+16), vertexArrayOffset+48);
                    vertexArrayOffset += VERTEX_STRIDE;
                }
            } else {
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
            }
            
            return vertexArray;
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
                                stripGroup.strips = StripHeader_t.readStructs(buffer, offset + stripGroup.stripOffset, stripGroup.numStrips);
                                stripGroup.verts = Vertex_t.readStructs(buffer, offset + stripGroup.vertOffset, stripGroup.numVerts);
                                stripGroup.indexArray = new DataView(buffer, offset + stripGroup.indexOffset, stripGroup.numIndices * 2);
                            });
                        });
                    });
                });
            });
            
            this.indexArray = this._buildIndices();
        }
    },
    
    _buildIndices: {
        value: function() {
            var indexCount = 0;
            this._iterateStripGroups(function(stripGroup) {
                indexCount +=  stripGroup.numIndices;
            }, this.lod);
            
            var indices = new Uint16Array(indexCount);
            var indexOffset = 0;
            var vertTableIndex;
            this._iterateStripGroups(function(stripGroup, mesh, model) {
                var vertTable = stripGroup.verts;
                stripGroup.indexOffset = indexOffset;
                for(var i = 0; i < stripGroup.numIndices; ++i) {
                    vertTableIndex = stripGroup.indexArray.getUint16(i*2, true);
                    var index = vertTable[vertTableIndex].origMeshVertID + model.vertexoffset + mesh.vertexoffset;
                    indices[indexOffset++] = index;
                }
            }, this.lod);
            
            return indices;
        }
    },
    
    _initializeBuffers: {
        value: function(gl) {
            this.vertBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, this.vertArray, gl.STATIC_DRAW);
            
            this.indexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexArray, gl.STATIC_DRAW);
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
        value: function(gl, viewMat, projectionMat, modelMat, shader) {
            if(!this.vertBuffer) { return; }
            
            if(!shader) {
                if(!sourceMdlShader) { return; }
                shader = sourceMdlShader;
                
                gl.useProgram(shader);

                gl.uniformMatrix4fv(shader.uniform.projectionMat, false, projectionMat);
                
                // Enable vertex arrays
                gl.enableVertexAttribArray(shader.attribute.position);
                gl.enableVertexAttribArray(shader.attribute.texture);
                gl.enableVertexAttribArray(shader.attribute.normal);
                gl.enableVertexAttribArray(shader.attribute.tangent);
                
                gl.uniform3f(shader.uniform.lightPos, 100, 100, 100);
                gl.uniformMatrix4fv(shader.uniform.viewMat, false, viewMat);
            };
            
            gl.uniformMatrix4fv(shader.uniform.modelMat, false, modelMat || modelIdentityMat);
            
            // It's too bad we can't do this in the shader
            mat4.multiply(viewMat, modelMat || modelIdentityMat, modelViewMat);
            mat4.toInverseMat3(modelViewMat, modelViewInvMat);
            gl.uniformMatrix3fv(shader.uniform.normalMat, false, modelViewInvMat);

            // Bind the appropriate buffers
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

            // Setup the vertex layout
            gl.vertexAttribPointer(shader.attribute.position, 3, gl.FLOAT, false, VERTEX_STRIDE, 16);
            gl.vertexAttribPointer(shader.attribute.normal, 3, gl.FLOAT, true, VERTEX_STRIDE, 28);
            gl.vertexAttribPointer(shader.attribute.texture, 2, gl.FLOAT, false, VERTEX_STRIDE, 40);
            gl.vertexAttribPointer(shader.attribute.tangent, 4, gl.FLOAT, false, VERTEX_STRIDE, 48);
            
            gl.uniform1i(shader.uniform.diffuse, 0);
            gl.uniform1i(shader.uniform.bump, 1);
            
            // Draw the mesh
            var self = this;
            var lastTexture = null;
            var lastBump = null;
            this._iterateStripGroups(function(stripGroup, mesh, model, bodyPart) {
                var materialId = mesh.material + (self.numSkinRef * self.skin);
                var material = self.textures[self.skinTable[materialId]].material;
                
                var texture = material ? material.texture : null;
                if(!texture) { texture = glUtil.defaultTexture; }
                
                var bump = material ? material.bump : null;
                if(!bump) { bump = glUtil.defaultBumpTexture; }
                
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, bump);
                
                for(var stripId in stripGroup.strips) {
                    var strip = stripGroup.strips[stripId];
                    gl.drawElements(gl.TRIANGLES, strip.numIndices, gl.UNSIGNED_SHORT, (stripGroup.indexOffset + strip.indexOffset) * 2);
                }
            }, this.lod);
        }
    },
});