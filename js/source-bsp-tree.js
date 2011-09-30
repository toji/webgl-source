/*
 * Valve Source Engine bsp tree navgation
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

var SourceBspTree = Object.create(Object, {
    planes: {
        value: null
    },
    
    models: {
        value: null
    },
    
    nodes: {
        value: null
    },
    
    leaves: {
        value: null
    },
    
    leafFaces: {
        value: null
    },
    
    clusterVis: {
        value: null
    },
    
    numClusters: {
        value: 0
    },

    parse: {
        value: function(buffer, header, planes) {
            this.planes = this._parseLump(buffer, header.lumps[LUMP_PLANES], dplane_t);
            this.models = this._parseLump(buffer, header.lumps[LUMP_MODELS], dmodel_t);
            this.nodes = this._parseLump(buffer, header.lumps[LUMP_NODES], dnode_t);
            this.leaves = this._parseLump(buffer, header.lumps[LUMP_LEAFS], dleaf_t);
            
            var leafFaceLump = header.lumps[LUMP_LEAFFACES];
            this.leafFaces = new Uint16Array(buffer, leafFaceLump.fileofs, leafFaceLump.filelen/2); // Possible alignment issues here!
            
            this._parseVis(buffer, header.lumps[LUMP_VISIBILITY]);
            
            return this;
        }
    },
    
    _parseLump: {
        value: function(buffer, lump, struct) {
            return struct.readStructs(buffer, lump.fileofs, lump.filelen/struct.byteLength);
        }
    },
    
    getLeafId: {
        value: function(pos) {
            var model = this.models[0];
            var index = model.headnode;
            var node = null;
            var plane = null;
            var normal = vec3.create();
            var dist = 0;
            
            // This should be a very fast trace down to the leaf that the given position is located in.
            while (index >= 0) {
                node = this.nodes[index];
                plane = this.planes[node.planenum];
                normal[0] = plane.normal.x; normal[1] = plane.normal.y; normal[2] = plane.normal.z; // TODO: Not this.
                
                dist = vec3.dot(normal, pos) - plane.dist;

                if (dist >= 0) {
                    index = node.children[0];
                } else {
                    index = node.children[1];
                }
            }

            return -(index+1);
        }
    },
    
    getLeafFaces: {
        value: function(leafId) {
            var leaf = this.leaves[leafId];
            return this.leafFaces.subarray(leaf.firstleafface, leaf.firstleafface + leaf.numleaffaces);
        }
    },
    
    addPropToLeaf: {
        value: function(leafId, propId) {
            var leaf = this.leaves[leafId];
            leaf.addProp(propId);
        }
    },
    
    getLeafProps: {
        value: function(leafId) {
            return this.leaves[leafId].props;
        }
    },
    
    /**
     * Determine if the given leaf is one that contains visibility information
     */
    isVisLeaf: {
        value: function(leafId) {
            return this.leaves[leafId].cluster != -1;
        }
    },
    
    _parseVis: {
        value: function(buffer, lump) {
            var offset = lump.fileofs;
            
            var visHeader = dvisheader_t.readStructs(buffer, offset, 1)[0];
            offset += dvisheader_t.byteLength;
            var numCluster = this.numClusters = visHeader.numclusters;
            var visOffsets = dvis_t.readStructs(buffer, offset, numCluster);
            var numBytes = Math.ceil(numCluster / 8);
            
            // This is wasting a lot of space, but it's a straightforward method for the time being
            // TODO: Optimize later
            var clusterVis = this.clusterVis = new Uint8Array(numCluster * numCluster);
            for(var i = 0; i < numCluster; ++i) {
                var rleVis = new Uint8Array(buffer, lump.fileofs + visOffsets[i].visofs, numBytes);
                var clusterOfs = i * numCluster;
                var v = 0;
                
                // Unpack the RLE visibility bitfield
                // See code at: http://www.flipcode.com/archives/Quake_2_BSP_File_Format.shtml
                for (var c = 0; c < numCluster; v++) {
                   if (rleVis[v] == 0) {
                      v++;     
                      c += 8 * rleVis[v];
                   } else {
                      for (var bit = 1; bit < 256; bit *= 2, c++) {
                         if (rleVis[v] & bit) {
                            clusterVis[clusterOfs + c] = 1;
                         }
                      }
                   }
                }
            }
        }
    },
    
    isLeafVisible: {
        value: function(fromLeafId, toLeafId) {
            if(fromLeafId == toLeafId) { return true; } // Leaves are always visible from themselves
            
            var fromLeaf = this.leaves[fromLeafId];
            var toLeaf = this.leaves[toLeafId];
            
            if(fromLeaf.cluster == -1 || !toLeaf.cluster == -1) { return false; }
            
            return this.clusterVis[(fromLeaf.cluster * this.numClusters) + toLeaf.cluster];
        }
    },
    
});
