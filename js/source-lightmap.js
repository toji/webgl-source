/*
 * Valve Source Engine Lightmap packing 
 * (A good deal of this is reused from my Quake 2 demo)
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
                    var expbuffer = lightingExp.subarray(lightOffset + 3, lightOffset + byteCount);
                    
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
