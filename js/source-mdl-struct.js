/*
 * Valve Source Engine MDL related structs
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
    Struct.skip(52),
    {
        material: {
            value: null
        },
        textureName: {
            value: null
        },
        readTextureName: {
            value: function(buffer, offset) {
                this.textureName = Struct.readString(buffer, offset + this.sznameindex);
            }
        }
    }
);

var MStudioTextureDir_t = Struct.create(
    Struct.int32("diroffset"),
    {
        textureDir: {
            value: null
        },
        readTextureDir: {
            value: function(buffer, offset) {
                this.textureDir = Struct.readString(buffer, offset + this.diroffset);
            }
        }
    }
);

var MStudioModelGroup_t = Struct.create(
    Struct.int32("szlabelindex"),
    Struct.int32("sznameindex")
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
    Struct.int32("numskinref"), Struct.int32("numskinfamilies"), Struct.int32("skinindex"),
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