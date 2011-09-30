/*
 * Common WebGL Utilities
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

var debugVS = "attribute vec3 position;\n";
debugVS += "uniform mat4 viewMat;\n";
debugVS += "uniform mat4 modelMat;\n";
debugVS += "uniform mat4 projectionMat;\n";
debugVS += "void main(void) {\n";
debugVS += " mat4 modelViewMat = viewMat * modelMat;\n";
debugVS += " vec4 vPosition = modelViewMat * vec4(position, 1.0);\n";
debugVS += " gl_Position = projectionMat * vPosition;\n";
debugVS += "}";

var debugFS = "uniform vec4 color;\n";
debugFS += "void main(void) {\n";
debugFS += " gl_FragColor = color;\n";
debugFS += "}";

var debugShader = null;
var debugMatrix = mat4.create();

var glUtil = Object.create(Object, {
    getContext: {
        value: function(canvas) {
            var context;
            
            if (canvas.getContext) {
                try {
                    context = canvas.getContext('webgl');
                    if(context) { return context; }
                } catch(ex) {}
                
                try {
                    context = canvas.getContext('experimental-webgl');
                    if(context) { return context; }
                } catch(ex) {}
            }
            return null;
        }
    },
    
    createShaderProgram: {
        value: function(gl, vertexShader, fragmentShader, attribs, uniforms) {
            var shaderProgram = gl.createProgram();

            var vs = this._compileShader(gl, vertexShader, gl.VERTEX_SHADER);
            var fs = this._compileShader(gl, fragmentShader, gl.FRAGMENT_SHADER);

            gl.attachShader(shaderProgram, vs);
            gl.attachShader(shaderProgram, fs);
            gl.linkProgram(shaderProgram);

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                gl.deleteProgram(shaderProgram);
                gl.deleteShader(vs);
                gl.deleteShader(fs);
                return null;
            }
            
            // Query any shader attributes and uniforms that we specified needing
            if(attribs) {
                shaderProgram.attribute = {};
                for(var i in attribs) {
                    var attrib = attribs[i];
                    shaderProgram.attribute[attrib] = gl.getAttribLocation(shaderProgram, attrib);
                }
            }

            if(uniforms) {
                shaderProgram.uniform = {};
                for(var i in uniforms) {
                    var uniform = uniforms[i];
                    shaderProgram.uniform[uniform] = gl.getUniformLocation(shaderProgram, uniform);
                }
            }

            return shaderProgram;
        }
    },
    
    _compileShader: {
        value: function(gl, source, type) {
            var shaderHeader = "#ifdef GL_ES\n";
            shaderHeader += "precision highp float;\n";
            shaderHeader += "#endif\n";

            var shader = gl.createShader(type);

            gl.shaderSource(shader, shaderHeader + source);
            gl.compileShader(shader);

            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.debug(gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }

            return shader;
        }
    },
    
    createSolidTexture: {
        value: function(gl, color) {
            var data = new Uint8Array(color);
            var texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, data);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            return texture;
        }
    },
    
    loadTexture: {
        value: function(gl, src, callback) {
            if(!this.textures) { this.textures = {}; }
            
            // Check to see if that URL has already been loaded
            var texture = this.textures[src];
            if(texture) { 
                if(callback) { callback(texture); }
                return texture;
            }
            
            var texture = gl.createTexture();
            var image = new Image();
            image.addEventListener("load", function() {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
                gl.generateMipmap(gl.TEXTURE_2D);
                
                if(callback) { callback(texture); }
            });
            image.src = src;
            
            this.textures[src] = texture;
            return texture;
        }
    },
    
    loadDefaultTexture: {
        value: function(gl, src) {
            if(this.defaultTexture) { return; }
            
            this.defaultTexture = this.loadTexture(gl, src);
            this.defaultBumpTexture = this.createSolidTexture(gl, [0, 0, 255]);
        }
    },
    
    _getDebugShader: {
        value: function(gl) {
            if(!debugShader) {
                debugShader = this.createShaderProgram(gl, debugVS, debugFS, ['position'], ['viewMat', 'modelMat', 'projectionMat', 'color']);
            }
            return debugShader;
        }
    },
    
    _buildCube: {
        value: function(gl) {
            if(this.cubeVertBuffer) { return; }
            var cubeVerts = [
                1, 1, 1,
                -1, 1, 1,
                1, -1, 1,
                -1, -1, 1,
                
                1, 1, -1,
                -1, 1, -1,
                1, -1, -1,
                -1, -1, -1,
            ];

            var cubeIndices = [
                0, 1, 2,
                2, 1, 3,

                4, 5, 6,
                6, 5, 7,

                0, 2, 4,
                4, 2, 6,
                
                1, 3, 5,
                5, 3, 7,
                
                0, 1, 4,
                4, 1, 5,
                
                2, 3, 6,
                6, 3, 7,
            ];

            this.cubeVertBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVertBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeVerts), gl.STATIC_DRAW);

            this.cubeIndexBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeIndexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeIndices), gl.STATIC_DRAW);
        }
    },
    
    drawCube: {
        value: function(gl, pos, size, color, viewMat, projectionMat) {
            var shader = this._getDebugShader(gl);
            this._buildCube(gl);
            
            mat4.identity(debugMatrix);
            mat4.translate(debugMatrix, pos);
            mat4.scale(debugMatrix, [size, size, size]);
            
            gl.useProgram(shader);
            
            gl.uniform4f(shader.uniform.color, color[0], color[1], color[2], color[3]);
            gl.uniformMatrix4fv(shader.uniform.projectionMat, false, projectionMat);
            gl.uniformMatrix4fv(shader.uniform.viewMat, false, viewMat);
            gl.uniformMatrix4fv(shader.uniform.modelMat, false, debugMatrix);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeVertBuffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeIndexBuffer);
            
            gl.enableVertexAttribArray(shader.attribute.position);
            gl.vertexAttribPointer(shader.attribute.position, 3, gl.FLOAT, false, 12, 0);
            
            gl.disable(gl.CULL_FACE);
            
            gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
            
            gl.enable(gl.CULL_FACE);
        }
    },
});