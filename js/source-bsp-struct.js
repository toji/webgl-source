/*
 * Valve Source Engine BSP related structs
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
// BSP Structs and constants
//=============

var MAX_INDEX = 65536;
var MAXLIGHTMAPS = 4;
var HEADER_LUMPS = 64;
var STATIC_PROP_NAME_LENGTH = 128;

var GAMELUMP_STATIC_PROPS = 1936749168; // 'sprp';

var LUMP_ENTITIES                   = 0,
    LUMP_PLANES                     = 1,
    LUMP_TEXDATA                    = 2,
    LUMP_VERTEXES                   = 3,
    LUMP_VISIBILITY                 = 4,
    LUMP_NODES                      = 5,
    LUMP_TEXINFO                    = 6,
    LUMP_FACES                      = 7,
    LUMP_LIGHTING                   = 8,
    LUMP_OCCLUSION                  = 9,
    LUMP_LEAFS                      = 10,
    LUMP_FACEIDS                    = 11,
    LUMP_EDGES                      = 12,
    LUMP_SURFEDGES                  = 13,
    LUMP_MODELS                     = 14,
    LUMP_WORLDLIGHTS                = 15,
    LUMP_LEAFFACES                  = 16,
    LUMP_LEAFBRUSHES                = 17,
    LUMP_BRUSHES                    = 18,
    LUMP_BRUSHSIDES                 = 19,
    LUMP_AREAS                      = 20,
    LUMP_AREAPORTALS                = 21,
    LUMP_UNUSED0                    = 22,
    LUMP_UNUSED1                    = 23,
    LUMP_UNUSED2                    = 24,
    LUMP_UNUSED3                    = 25,
    LUMP_DISPINFO                   = 26,
    LUMP_ORIGINALFACES              = 27,
    LUMP_PHYSDISP                   = 28,
    LUMP_PHYSCOLLIDE                = 29,
    LUMP_VERTNORMALS                = 30,
    LUMP_VERTNORMALINDICES          = 31,
    LUMP_DISP_LIGHTMAP_ALPHAS       = 32,
    LUMP_DISP_VERTS                 = 33,
    LUMP_DISP_LIGHTMAP_SAMPLE_POSITIONS = 34,
    LUMP_GAME_LUMP                  = 35,
    LUMP_LEAFWATERDATA              = 36,
    LUMP_PRIMITIVES                 = 37,
    LUMP_PRIMVERTS                  = 38,
    LUMP_PRIMINDICES                = 39,
    LUMP_PAKFILE                    = 40,
    LUMP_CLIPPORTALVERTS            = 41,
    LUMP_CUBEMAPS                   = 42,
    LUMP_TEXDATA_STRING_DATA        = 43,
    LUMP_TEXDATA_STRING_TABLE       = 44,
    LUMP_OVERLAYS                   = 45,
    LUMP_LEAFMINDISTTOWATER         = 46,
    LUMP_FACE_MACRO_TEXTURE_INFO    = 47,
    LUMP_DISP_TRIS                  = 48,
    LUMP_PHYSCOLLIDESURFACE         = 49,
    LUMP_WATEROVERLAYS              = 50,
    LUMP_LEAF_AMBIENT_INDEX_HDR     = 51,
    LUMP_LEAF_AMBIENT_INDEX         = 52,
    LUMP_LIGHTING_HDR               = 53,
    LUMP_WORLDLIGHTS_HDR            = 54,
    LUMP_LEAF_AMBIENT_LIGHTING_HDR  = 55,
    LUMP_LEAF_AMBIENT_LIGHTING      = 56,
    LUMP_XZIPPAKFILE                = 57,
    LUMP_FACES_HDR                  = 58,
    LUMP_MAP_FLAGS                  = 59,
    LUMP_OVERLAY_FADES              = 60;

// TexInfo Flags
var SURF_LIGHT = 0x0001, // value will hold the light strength
    SURF_SKY2D = 0x0002, // don't draw, indicates we should skylight + draw 2d sky but not draw the 3D skybox
    SURF_SKY = 0x0004, // don't draw, but add to skybox
    SURF_WARP = 0x0008, // turbulent water warp
    SURF_TRANS = 0x0010,
    SURF_NOPORTAL = 0x0020, // the surface can not have a portal placed on it
    SURF_TRIGGER = 0x0040, // FIXME: This is an xbox hack to work around elimination of trigger surfaces, which breaks occluders
    SURF_NODRAW = 0x0080, // don't bother referencing the texture
    SURF_HINT = 0x0100, // make a primary bsp splitter
    SURF_SKIP = 0x0200, // completely ignore, allowing non-closed brushes
    SURF_NOLIGHT = 0x0400, // Don't calculate light
    SURF_BUMPLIGHT = 0x0800, // calculate three lightmaps for the surface for bumpmapping
    SURF_NOSHADOWS = 0x1000, // Don't receive shadows
    SURF_NODECALS = 0x2000, // Don't receive decals
    SURF_NOCHOP = 0x4000, // Don't subdivide patches on this surface 
    SURF_HITBOX = 0x8000; // surface is part of a hitbox

var Vector = Struct.create(
    Struct.float32("x"),
    Struct.float32("y"),
    Struct.float32("z")
);

var QAngle = Struct.create(
    Struct.float32("x"),
    Struct.float32("y"),
    Struct.float32("z")
);

var ColorRGBExp32 = Struct.create(
    Struct.uint8("r"), Struct.uint8("g"), Struct.uint8("b"),
    Struct.int8("exponent")
);

var CompressedLightCube = Struct.create(
    Struct.array("m_Color", ColorRGBExp32, 6)
);

var lump_t = Struct.create(
    Struct.int32("fileofs"),
    Struct.int32("filelen"),
    Struct.int32("version"),
    Struct.int32("fourCC")
);

var dheader_t = Struct.create(
    Struct.string("ident", 4),
    Struct.int32("version"),
    Struct.array("lumps", lump_t, HEADER_LUMPS),
    Struct.int32("mapRevision")
);

var dplane_t = Struct.create(
    Struct.struct("normal", Vector),
    Struct.float32("dist"),
    Struct.int32("type")
);

var dedge_t = Struct.create(
    Struct.array("v", Struct.uint16(), 2)
);

var dface_t = Struct.create(
    Struct.uint16("planenum"),
    Struct.int8("side"),
    Struct.int8("onNode"),
    Struct.int32("firstedge"),
    Struct.int16("numedges"),   
    Struct.int16("texinfo"),
    Struct.int16("dispinfo"),
    Struct.int16("surfaceFogVolumeID"),
    Struct.array("styles", Struct.uint8(), MAXLIGHTMAPS),
    Struct.int32("lightofs"),
    Struct.float32("area"),
    Struct.array("m_LightmapTextureMinsInLuxels", Struct.int32(), 2),
    Struct.array("m_LightmapTextureSizeInLuxels", Struct.int32(), 2),
    Struct.int32("origFace"),
    Struct.uint16("m_NumPrims"),
    Struct.uint16("firstPrimID"),
    Struct.uint32("smoothingGroups")
);

var texinfo_vec = Struct.create(
    Struct.float32("x"),
    Struct.float32("y"),
    Struct.float32("z"),
    Struct.float32("offset")
);

var texinfo_t = Struct.create(
    Struct.array("textureVecsTexelsPerWorldUnits", texinfo_vec, 2),
    Struct.array("lightmapVecsLuxelsPerWorldUnits", texinfo_vec, 2),
    Struct.int32("flags"), 
    Struct.int32("texdata")
);

var dtexdata_t = Struct.create(
    Struct.struct("reflectivity", Vector),
    Struct.int32("nameStringTableID"),
    Struct.int32("width"),
    Struct.int32("height"),
    Struct.int32("view_width"), 
    Struct.int32("view_height"),
    {
        faces: {
            value: null
        },
        
        addFace: {
            value: function(face) {
                if(!this.faces) {
                    this.faces = [];
                }
                this.faces.push(face);
            }
        },
        
        numvertex: {
            value: 0
        }
    }
);

var dmodel_t = Struct.create(
    Struct.struct("mins", Vector), Struct.struct("maxs", Vector),
    Struct.struct("origin", Vector),
    Struct.int32("headnode"),
    Struct.int32("firstface"),
    Struct.int32("numfaces")
);

var dnode_t = Struct.create(
    Struct.int32("planenum"),
    Struct.array("children", Struct.int32(), 2),
    Struct.array("mins", Struct.int16(), 3),
    Struct.array("maxs", Struct.int16(), 3),
    Struct.uint16("firstface"),
    Struct.uint16("numfaces"),
    Struct.int16("area"),
    Struct.int16("paddding")
);

var dleaf_t = Struct.create(
    Struct.int32("contents"),
    Struct.int16("cluster"),
    Struct.int8("area"), // Packing issues here, should be 9 bits
    Struct.int8("flags"), // packing issues here, should be 7 bits
    Struct.array("mins", Struct.int16(), 3),
    Struct.array("maxs", Struct.int16(), 3),
    Struct.uint16("firstleafface"),
    Struct.uint16("numleaffaces"),
    Struct.uint16("firstleafbrush"),
    Struct.uint16("numleafbrushes"),
    Struct.int16("leafWaterDataID"),
    //Struct.struct("ambientLighting", CompressedLightCube),
    Struct.skip(2), // Pad to 4 byte boundries
    {
        props: {
            value: null
        },
        
        addProp: {
            value: function(prop) {
                if(!this.props) {
                    this.props = [];
                }
                this.props.push(prop);
            }
        },
        
        triStrips: {
            value: null
        },
        
        addTriStrip: {
            value: function(triStrip) {
                if(!this.triStrips) {
                    this.triStrips = [];
                }
                this.triStrips.push(triStrip);
            }
        }
    }
);

var dvisheader_t = Struct.create(
    Struct.int32("numclusters")
);

var dvis_t = Struct.create(
    Struct.int32("visofs"),
    Struct.int32("audofs")
);

var dbrush_t = Struct.create(
    Struct.int32("firstside"),
    Struct.int32("numsides"),
    Struct.int32("contents")
);

var dbrushside_t = Struct.create(
    Struct.uint16("planenum"),
    Struct.int16("texinfo"),
    Struct.int16("dispinfo"),
    Struct.int16("bevel")
);

var dgamelumpheader_t = Struct.create(
    Struct.int32("lumpCount")
);

var dgamelump_t = Struct.create(
    Struct.int32("id"),
    Struct.uint16("flags"),
    Struct.uint16("version"),
    Struct.int32("fileofs"),
    Struct.int32("filelen")
);

var StaticPropDictLumpHeader_t = Struct.create(
    Struct.int32("dictEntries")
);

var StaticPropDictLump_t = Struct.create(
    Struct.string("m_Name", STATIC_PROP_NAME_LENGTH),
    {
        props: {
            value: null
        },
        
        addProp: {
            value: function(prop) {
                if(!this.props) {
                    this.props = [];
                }
                this.props.push(prop);
            }
        }
    }
);

var StaticPropLeafLumpHeader_t = Struct.create(
    Struct.int32("leafEntries")
);

var StaticPropLeafLump_t = Struct.create(
    Struct.uint16("m_Leaf")
);

var StaticPropLumpHeader_t = Struct.create(
    Struct.int32("propEntries")
);

var StaticPropLump_t = Struct.create(
    Struct.struct("m_Origin", Vector),
    Struct.struct("m_Angles", QAngle),
    Struct.uint16("m_PropType"),
    Struct.uint16("m_FirstLeaf"),
    Struct.uint16("m_LeafCount"),
    Struct.uint8("m_Solid"),
    Struct.uint8("m_Flags"),
    Struct.int32("m_Skin"),
    Struct.float32("m_FadeMinDist"),
    Struct.float32("m_FadeMaxDist"),
    Struct.struct("m_LightingOrigin", Vector),
    Struct.float32("m_flForcedFadeScale"),
    Struct.uint16("m_nMinDXLevel"),
    Struct.uint16("m_nMaxDXLevel")
);

// Displacment surfaces
var MAX_DISP_CORNER_NEIGHBORS = 4;
var ALLOWEDVERTS_SIZE = 17*17;

var CDispSubNeighbor = Struct.create(
    Struct.uint16("m_iNeighbor"),
    Struct.uint8("m_NeighborOrientation"),
    Struct.uint8("m_Span"),
    Struct.uint8("m_NeighborSpan")
);

var CDispNeighbor = Struct.create(
    Struct.array("m_SubNeighbors", CDispSubNeighbor, 2)
);

var CDispCornerNeighbors = Struct.create(
    Struct.array("m_Neighbors", Struct.uint16(), MAX_DISP_CORNER_NEIGHBORS),
    Struct.uint8("m_nNeighbors")
);

var ddispinfo_t = Struct.create(
    Struct.struct("startPosition", Vector),
    Struct.int32("DispVertStart"),
    Struct.int32("DispTriStart"),
    Struct.int32("power"),
    Struct.int32("minTess"), 
    Struct.float32("smoothingAngle"),
    Struct.int32("contents"),
    Struct.uint16("MapFace"),
    Struct.int32("LightmapAlphaStart"),
    Struct.int32("LightmapSamplePositionStart"),
    Struct.array("EdgeNeighbors", CDispNeighbor, 4),
    Struct.array("CornerNeighbors", CDispCornerNeighbors, 4),
    Struct.array("AllowedVerts", Struct.uint32(), ALLOWEDVERTS_SIZE)
);

var dDispVert = Struct.create(
    Struct.struct("vec", Vector),
    Struct.float32("dist"),
    Struct.float32("alpha")
);

var dDispTri = Struct.create(
    Struct.uint16("Tags")
);