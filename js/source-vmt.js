/*
 * Valve Source Engine Material (VMT) parsing
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

//
// Shader Tokenizer
//

var ShaderTokenizer = function(src) {
    // Strip out comments
    src = src.replace(/\/\/.*$/mg, ''); // C++ style (//...)
    src = src.replace(/\/\*[^*\/]*\*\//mg, ''); // C style (/*...*/) (Do the shaders even use these?)
    // Some simple replacements to ensure that brackets are parse correctly
    src = src.replace(/\[/mg, ' [ ');
    src = src.replace(/\]/mg, ' ] '); 
    this.tokens = src.match(/[^\s\n\r\"]+/mg);
    
    this.offset = 0;
};

ShaderTokenizer.prototype.EOF = function() {
    if(this.tokens == null) { return true; }
    var token = this.tokens[this.offset];
    while(token == '' && this.offset < this.tokens.length) {
        this.offset++
        token = this.tokens[this.offset];
    }
    return this.offset >= this.tokens.length; 
};

ShaderTokenizer.prototype.next = function() {
    if(this.tokens == null) { return ; }
    var token = '';
    while(token == '' && this.offset < this.tokens.length) {
        token = this.tokens[this.offset++];
    }
    return token;
};

ShaderTokenizer.prototype.prev = function() {
    if(this.tokens == null) { return ; }
    var token = '';
    while(token == '' && this.offset >= 0) {
        token = this.tokens[this.offset--];
    }
    return token;
};

//=============
// VMT
//=============

var SourceMaterial = Object.create(Object, {
    texture: {
        value: null
    },
    
    load: {
        value: function(gl, rootUrl, searchDirs, url) {
            var self = this;
            
            if(!url) {
                url = searchDirs;
                searchDirs = [""];
            }
            
            function tryDir(searchDirId) {
                if(searchDirId >= searchDirs.length) { return; }
                
                var searchDir = searchDirs[searchDirId];
                var vmtXhr = new XMLHttpRequest();
                vmtXhr.open('GET', rootUrl + searchDir + url + ".vmt", true);
                vmtXhr.addEventListener("load", function() {
                    if (vmtXhr.status == 200) {  
                        var material = self._parseVmt(this.responseText);
                        self._compileMaterial(gl, rootUrl, material);
                    } else {
                        tryDir(searchDirId+1);
                    }
                });
                vmtXhr.addEventListener("error", function() {
                    tryDir(searchDirId++);
                });
                vmtXhr.send(null);
            }
            tryDir(0);
            
            return this;
        }
    },
    
    _parseVmt: {
        value: function(src) {
            var tokens = new ShaderTokenizer(src);
            
            var material = {
                shader: tokens.next()
            };
            
            var brace = tokens.next();
            if(brace != "{") { 
                return null; 
            }
            
            // Evaluate each of the shader params, utilize the ones that we can
            while(!tokens.EOF()) {
                var token = tokens.next().toLowerCase();
                if(token == '}') { break; }
                
                switch (token) {
                    case "{":
                    case "[": {
                        this._skipSection(tokens, token);
                    } break;
                    
                    case "$basetexture": {
                        material.basetexture = tokens.next();
                    } break;
                }
            }
            
            return material;
        }
    },
    
    /* Helper to skip over unknown sections or arrays */
    _skipSection: {
        value: function(tokens, type) {
            while(!tokens.EOF()) {
                var token = tokens.next().toLowerCase();
                if(type == "{" && token == "}") { break; }
                if(type == "[" && token == "]") { break; }
                
                switch (token) {
                    case "{":
                    case "[": {
                        this._skipSection(tokens, token);
                    } break;
                }
            }
        }
    },
    
    _compileMaterial: {
        value: function(gl, rootUrl, material) {
            var self = this;
            
            if(material == null) { return; }
            
            if(material.basetexture) {
                glUtil.loadTexture(gl, rootUrl + "/" + material.basetexture + ".png", function(texture) {
                    self.texture = texture;
                });
            }
        }
    }
    
});

