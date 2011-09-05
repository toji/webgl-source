/*
 * Basic Camera Types for WebGL demos
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

/**
 * A ModelDemoCamera is one that always points at a central point and orbits around at a fixed radius
 * This type of camera is good for displaying individual models
 */
var ModelDemoCamera = Object.create(Object, {
    projectionMat: {
        value: null
    },
    
    orbitX: {
        value: 0
    },
    
    orbitY: {
        value: 0
    },
    
    distance: {
        value: 15
    },
    
    center: {
        value: null
    },
    
    _dirty: {
        value: true
    },
    
    _viewMat: {
        value: null
    },
    
    viewMat: {
        get: function() {
            if(this._dirty) {
                var mv = this._viewMat;
                mat4.identity(mv);
                mat4.translate(mv, [0, 0, -this.distance]);
                mat4.rotateX(mv, this.orbitX+(Math.PI/2));
                mat4.translate(mv, this.center);
                mat4.rotateX(mv, -Math.PI/2);
                mat4.rotateY(mv, this.orbitY);
                
                this._dirty = false;
            }
            
            return this._viewMat;
        }
    },
    
    init: {
        value: function(canvas) {
            this.center = [0, 0, 0];
            
            // Initialize the matricies
            this.projectionMat = mat4.create();
            this._viewMat = mat4.create();
            
            mat4.perspective(45.0, canvas.width/canvas.height, 1.0, 1000.0, this.projectionMat);
            
            // Set up the appropriate event hooks
            var moving = false;
            var lastX, lastY;
            var self = this;
            canvas.addEventListener('mousedown', function(event) {
                if(event.which == 1) {
                    moving = true;
                }
                lastX = event.pageX;
                lastY = event.pageY;
            });
            
            canvas.addEventListener('mousemove', function(event) {
                if (moving) {
                    var xDelta = event.pageX  - lastX;
                    var yDelta = event.pageY  - lastY;
                    lastX = event.pageX;
                    lastY = event.pageY;
                    
                    self.orbitY += xDelta*0.025;
                    while (self.orbitY < 0)
                        self.orbitY += Math.PI*2;
                    while (self.orbitY >= Math.PI*2)
                        self.orbitY -= Math.PI*2;
                        
                    self.orbitX += yDelta*0.025;
                    while (self.orbitX < 0)
                        self.orbitX += Math.PI*2;
                    while (self.orbitX >= Math.PI*2)
                        self.orbitX -= Math.PI*2;
                        
                    self._dirty = true;
                }
            });
            
            canvas.addEventListener('mouseup', function(event) {
                moving = false;
            });
            
            return this;
        }
    },
    
    update: {
        value: function(frameTime) {
            // Not actually needed here. Just makes switching between camera types easier
        }
    }
});

/**
 * A FlyingDemoCamera allows free motion around the scene using FPS style controls (WASD + mouselook)
 * This type of camera is good for displaying large scenes
 */
var FlyingDemoCamera = Object.create(Object, {
    projectionMat: {
        value: null
    },
    
    _angles: {
        value: null
    },
    
    angles: {
        get: function() {
            return this._angles;
        },
        set: function(value) {
            this._angles = value;
            this._dirty = true;
        }
    },
    
    _position: {
        value: null
    },
    
    position: {
        get: function() {
            return this._position;
        },
        set: function(value) {
            this._position = value;
            this._dirty = true;
        }
    },
    
    speed: {
        value: 100
    },
    
    _dirty: {
        value: true
    },
    
    _cameraMat: {
        value: null
    },
    
    _pressedKeys: {
        value: null
    },
    
    _viewMat: {
        value: null
    },
    
    viewMat: {
        get: function() {
            if(this._dirty) {
                var mv = this._viewMat;
                mat4.identity(mv);
                mat4.rotateX(mv, this.angles[0]-Math.PI/2.0);
                mat4.rotateZ(mv, this.angles[1]);
                mat4.rotateY(mv, this.angles[2]);
                mat4.translate(mv, [-this.position[0], -this.position[1], - this.position[2]]);
                this._dirty = false;
            }
            
            return this._viewMat;
        }
    },
    
    init: {
        value: function(canvas) {
            this.angles = vec3.create();
            this.position = vec3.create();
            this.pressedKeys = new Array(128);
            
            // Initialize the matricies
            this.projectionMat = mat4.create();
            this._viewMat = mat4.create();
            this._cameraMat = mat4.create();
            
            mat4.perspective(45.0, canvas.width/canvas.height, 1.0, 10000.0, this.projectionMat);
            
            // Set up the appropriate event hooks
            var moving = false;
            var lastX, lastY;
            var self = this;
            
            window.onkeydown = function(event) {
                self.pressedKeys[event.keyCode] = true;
            }

            window.onkeyup = function(event) {
                self.pressedKeys[event.keyCode] = false;
            }
            
            canvas.addEventListener('mousedown', function(event) {
                if(event.which == 1) {
                    moving = true;
                }
                lastX = event.pageX;
                lastY = event.pageY;
            });
            
            canvas.addEventListener('mousemove', function(event) {
                if (moving) {
                    var xDelta = event.pageX  - lastX;
                    var yDelta = event.pageY  - lastY;
                    lastX = event.pageX;
                    lastY = event.pageY;
                    
                    self.angles[1] += xDelta*0.025;
                    while (self.angles[1] < 0)
                        self.angles[1] += Math.PI*2;
                    while (self.angles[1] >= Math.PI*2)
                        self.angles[1] -= Math.PI*2;

                    self.angles[0] += yDelta*0.025;
                    while (self.angles[0] < -Math.PI*0.5)
                        self.angles[0] = -Math.PI*0.5;
                    while (self.angles[0] > Math.PI*0.5)
                        self.angles[0] = Math.PI*0.5;
                        
                    self._dirty = true;
                }
            });
            
            canvas.addEventListener('mouseup', function(event) {
                moving = false;
            });
            
            return this;
        }
    },
    
    update: {
        value: function(frameTime) {
            var dir = [0, 0, 0];

            var speed = (this.speed / 1000) * frameTime;

            // This is our first person movement code. It's not really pretty, but it works
            if(this.pressedKeys['W'.charCodeAt(0)]) {
                dir[1] += speed;
            }
            if(this.pressedKeys['S'.charCodeAt(0)]) {
                dir[1] -= speed;
            }
            if(this.pressedKeys['A'.charCodeAt(0)]) {
                dir[0] -= speed;
            }
            if(this.pressedKeys['D'.charCodeAt(0)]) {
                dir[0] += speed;
            }
            if(this.pressedKeys[32]) { // Space, moves up
                dir[2] += speed;
            }
            if(this.pressedKeys[17]) { // Ctrl, moves down
                dir[2] -= speed;
            }

            if(dir[0] != 0 || dir[1] != 0 || dir[2] != 0) {
                var cam = this._cameraMat;
                mat4.identity(cam);
                mat4.rotateX(cam, this.angles[0]);
                mat4.rotateZ(cam, this.angles[1]);
                mat4.inverse(cam);

                mat4.multiplyVec3(cam, dir);

                // Move the camera in the direction we are facing
                vec3.add(this.position, dir);
                
                this._dirty = true;
            }
        }
    }
});