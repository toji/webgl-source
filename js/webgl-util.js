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
    }
});