/*
 * Valve Source Engine texture (VTF) parsing
 */
 
//============================================================================
// NOTE! I was going to investigate parsing VTF files directly, but it turned 
// out to be much easier just to do a batch export to PNG. As such, this file
// is just a useless stub. Left it here in case I want to try again later.
//============================================================================

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
// VTF Constants
//=============

var IMAGE_FORMAT_NONE = -1,
	IMAGE_FORMAT_RGBA8888 = 0,
	IMAGE_FORMAT_ABGR8888 = 1,
	IMAGE_FORMAT_RGB888 = 2,
	IMAGE_FORMAT_BGR888 = 3,
	IMAGE_FORMAT_RGB565 = 4,
	IMAGE_FORMAT_I8 = 5,
	IMAGE_FORMAT_IA88 = 6,
	IMAGE_FORMAT_P8 = 7,
	IMAGE_FORMAT_A8 = 8,
	IMAGE_FORMAT_RGB888_BLUESCREEN = 9,
	IMAGE_FORMAT_BGR888_BLUESCREEN = 10,
	IMAGE_FORMAT_ARGB8888 = 11,
	IMAGE_FORMAT_BGRA8888 = 12,
	IMAGE_FORMAT_DXT1 = 13,
	IMAGE_FORMAT_DXT3 = 14,
	IMAGE_FORMAT_DXT5 = 15,
	IMAGE_FORMAT_BGRX8888 = 16,
	IMAGE_FORMAT_BGR565 = 17,
	IMAGE_FORMAT_BGRX5551 = 18,
	IMAGE_FORMAT_BGRA4444 = 19,
	IMAGE_FORMAT_DXT1_ONEBITALPHA = 20,
	IMAGE_FORMAT_BGRA5551 = 21,
	IMAGE_FORMAT_UV88 = 22,
	IMAGE_FORMAT_UVWQ8888 = 23,
	IMAGE_FORMAT_RGBA16161616F = 24,
	IMAGE_FORMAT_RGBA16161616 = 25,
	IMAGE_FORMAT_UVLX8888 = 26;
	
var TEXTUREFLAGS_POINTSAMPLE = 0x00000001,
    TEXTUREFLAGS_TRILINEAR = 0x00000002,
	TEXTUREFLAGS_CLAMPS = 0x00000004,
	TEXTUREFLAGS_CLAMPT = 0x00000008,
	TEXTUREFLAGS_ANISOTROPIC = 0x00000010,
	TEXTUREFLAGS_HINT_DXT5 = 0x00000020,
	TEXTUREFLAGS_PWL_CORRECTED = 0x00000040,
	TEXTUREFLAGS_NORMAL = 0x00000080,
	TEXTUREFLAGS_NOMIP = 0x00000100,
	TEXTUREFLAGS_NOLOD = 0x00000200,
	TEXTUREFLAGS_ALL_MIPS = 0x00000400,
	TEXTUREFLAGS_PROCEDURAL = 0x00000800,
	TEXTUREFLAGS_ONEBITALPHA = 0x00001000,
	TEXTUREFLAGS_EIGHTBITALPHA = 0x00002000,
	TEXTUREFLAGS_ENVMAP = 0x00004000,
	TEXTUREFLAGS_RENDERTARGET = 0x00008000,
	TEXTUREFLAGS_DEPTHRENDERTARGET = 0x00010000,
	TEXTUREFLAGS_NODEBUGOVERRIDE = 0x00020000,
	TEXTUREFLAGS_SINGLECOPY	= 0x00040000,
	TEXTUREFLAGS_PRE_SRGB = 0x00080000,
    TEXTUREFLAGS_UNUSED_00100000 = 0x00100000,
	TEXTUREFLAGS_UNUSED_00200000 = 0x00200000,
	TEXTUREFLAGS_UNUSED_00400000 = 0x00400000,
	TEXTUREFLAGS_NODEPTHBUFFER = 0x00800000,
	TEXTUREFLAGS_UNUSED_01000000 = 0x01000000,
	TEXTUREFLAGS_CLAMPU = 0x02000000,
	TEXTUREFLAGS_VERTEXTEXTURE = 0x04000000,
	TEXTUREFLAGS_SSBUMP = 0x08000000,			
	TEXTUREFLAGS_UNUSED_10000000 = 0x10000000,
	TEXTUREFLAGS_BORDER = 0x20000000,
	TEXTUREFLAGS_UNUSED_40000000 = 0x40000000,
	TEXTUREFLAGS_UNUSED_80000000 = 0x80000000,

//=============
// VTF Structs
//=============

var VtfHeader = Struct.create(
	Struct.string("signature", 4),
	Struct.array("version", Struct.uint32(), 2),
	Struct.uint32("headerSize"),
	Struct.uint16("width"),
	Struct.uint16("height"),
	Struct.uint32("flags"),
	Struct.uint16("frames"),
	Struct.uint16("firstFrame"),
	Struct.array("padding0", Struct.uint8(), 4),
	Struct.array("reflectivity", Struct.float32(), 3),
	Struct.array("padding1", Struct.uint8(), 4),
	Struct.float32("bumpmapScale"),
	Struct.uint32("highResImageFormat"),
	Struct.uint8("mipmapCount"),
	Struct.uint32("lowResImageFormat"),
	Struct.uint8("lowResImageWidth"),
	Struct.uint8("lowResImageHeight"),
	Struct.uint16("depth")
);

var SourceTexture = Object.create(Object, {
    load: {
        value: function(gl, url) {
            var self = this;
            
            var vtfXhr = new XMLHttpRequest();
            vtfXhr.open('GET', url + ".vtf", true);
            vtfXhr.responseType = "arraybuffer";
            vtfXhr.addEventListener("load", function() {
                var bspData = self._parseVtf(this.response);
            });
            vtfXhr.send(null);
            
            return this;
        }
    },
    
    _parseVtf: {
        value: function(buffer) {
            var header = VtfHeader.readStructs(buffer, 0, 1)[0];
            
            // Hm... What to do? DXT unpacking in JS? *shudder*
        }
    },
});
