$(document).ready(function () {
	window.game = new Game();
	game.init();
});

/*
 * --- GAME OBJECT ---
 */

function Game (options) {
	this.baseURL            = 'http://www.killerbee.si/speedracer/';
    this.wheelPosition      = 0;
    this.speed              = 0;
    this._maxSpeed          = 200;
    this._grassSpeed        = 120;
    this._fullLife          = 10;
    this.life               = this._fullLife;
    this.wheelArray         = [];
    this.obstaclesArray     = [];
    this._slidingWindow     = 3;
    this._carHandlingFactor = 2000;
    this._speedFactor       = 5;
    this._gameWidth         = $('.container').width();
    this._gameHeight        = $('.container').height();
    this.gameRunning        = false;
    this._grassWidth        = $('.grass').width();
    this._numLanes          = 12;
    this._gameContainer     = $('.container');
    this._lifeBar           = $('.lifebar');
    this.stopObstacles      = false;
    this.obstaclesTriggered = false;

    this._road = {
        node: $('.road'),
        position: { x: 0, y: -1024 },
        size: { 
            width: parseInt($('.road').css('width'), 10), 
            height: 1024 
        }
    };

    this._grassLeft = {
        node: $('.grass.left'),
        position: { x: null, y: -1024 },
        size: {
            width: parseInt($('.grass.left').css('width'), 10), 
            height: 1024
        }
    };

    this._grassRight = {
        node: $('.grass.right'),
        position: { x: null, y: -1024 },
        size: {
            width: parseInt($('.grass.right').css('width'), 10), 
            height: 1024
        }
    };

    this._car = {
        node: $('.car'),
        size: { 
            width: parseInt($('.car').css('width'), 10),
            height: parseInt($('.car').css('height'), 10)
        },
        position: { 
            x: Math.round(this._gameWidth / 2), 
            y: 300
        },
        rotation: 0
    };

    this._carHitpoint = {
        node: $('.car-hitpoint'),
        position: {
            x: Math.round(this._gameWidth / 2), 
            y: 300
        }
    }

    this._speedometer = {
        node: $('.speed')
    };

    this.tick = bind(this, this.tick);
}

Game.prototype.init = function () {
	// getting orientation data from window
	window.addEventListener('deviceorientation', this.deviceOrientation.bind(this));
    
    // set car to the initial position
    this._car.node.css({ '-webkit-transform': 'translate3D(' + this._car.position.x + 'px, 0, 0) rotateZ(' + this._car.rotation + 'deg)' });

    // fill life
    this.initLifeBar(this._fullLife);

    this.start();
};

Game.prototype.initLifeBar = function (value) {
    for (var i = 0; i < value; i++) {
        this._lifeBar.append('<li>&nbsp;</li>');
    }
};

Game.prototype.decreaseLife = function () {
    $('.lifebar li:last-child').remove();
    this.life--;
};

Game.prototype.deviceOrientation = function (e) {
    var wheelTotal = 0;

    if (e.beta < 90 && e.beta > -90)
        this.wheelArray.push(e.beta);

    if (this.wheelArray.length > this._slidingWindow) 
        this.wheelArray.splice(0,1);

    for (var i = 0; i < this.wheelArray.length; i++) {
        wheelTotal += this.wheelArray[i];
    }

    this.wheelPosition = Math.round(wheelTotal / this.wheelArray.length);
};

Game.prototype.start = function () {
    this.startTime = +new Date;

    this.gameRunning = true;

	this.tick();
};

Game.prototype.tick = function () {
    var drawn,
        elapsed,
        currentTime,
        countdownTime;

    if (this.gameRunning)
        this._rafId = requestAnimationFrame(this.tick);

    currentTime = +new Date;
    if (this.lastUpdateTime == null)
        this.lastUpdateTime = currentTime;

    elapsed       = currentTime - this.lastUpdateTime;
    countdownTime = currentTime - this.startTime

    // update physics
    this.update(elapsed, countdownTime);

    // redraw all objects positions
    this.draw();
        
    this.lastUpdateTime = currentTime;    
};

Game.prototype.update = function (elapsed, countdownTime) {
    if (this.speed < this._maxSpeed && !this.carTwitching) {
        this.speed += 2;
    } else {
        if (!this.obstaclesTriggered) {
            this.triggerObstacles();
            this.obstaclesTriggered = true;
        } 
    }

    // car on grass
    if (this._car.position.x < this._grassWidth - Math.round(this._car.size.width / 2) || this._car.position.x > this._gameWidth - this._grassWidth - Math.round(this._car.size.width / 2)) {
        if (this.speed > this._grassSpeed)
            this.speed -= 2;
        this.carTwitching = true;
    } else {
        this.carTwitching = false;
    }
    this.currentSpeed = this.speed;

    // update obstacles
    if (this.obstaclesArray.length > 1) {
        for (var i = 0; i < this.obstaclesArray.length; i++) {
            // if moving obstacle detects other obstacle in front of it, match speed
            if (this.obstaclesArray[i].motion == 'moving') {
                for (var j = 0; j < this.obstaclesArray.length; j++) {
                    if (this.obstaclesArray[j].lane == this.obstaclesArray[i].lane && (this.obstaclesArray[j].position.y + 40) > this.obstaclesArray[i].position.y) {
                        this.obstaclesArray[i].speed = this.obstaclesArray[j].speed;
                    }
                }
            }

            this.obstaclesArray[i].position.y += Math.round(((this.currentSpeed - this.obstaclesArray[i].speed) * elapsed) / 1000);

            // destroy obstacle if off screen
            if (this.obstaclesArray[i].position.y > this._gameHeight) {
                this.destroyObstacle(i);
            }
        }
    }

    var basicYPosition = Math.round((this.currentSpeed * elapsed) / 1000);

    // update road position
    this._road.position.y += basicYPosition;
    if (this._road.position.y >= 0)
        this._road.position.y = -this._road.size.height;

    // update grass position
    this._grassLeft.position.y += basicYPosition;
    if (this._grassLeft.position.y >= 0)
        this._grassLeft.position.y = -this._grassLeft.size.height;

    this._grassRight.position.y += basicYPosition;
    if (this._grassRight.position.y >= 0)
        this._grassRight.position.y = -this._grassRight.size.height;

    // update car rotation and position
    this._car.rotation = this.getCarRotation();
    this._car.position.x += this.getCarPosition();

    // edge of the game
    if (this._car.position.x <= 0) {
        this._car.position.x = 0;
        this._car.rotation = 0;
    } else if (this._car.position.x >= (this._road.size.width - this._car.size.width)) {
        this._car.position.x = this._road.size.width - this._car.size.width;
        this._car.rotation = 0;
    }

    this.checkCollisions();
};

Game.prototype.draw = function () {
    this._speedometer.node.html(this.currentSpeed < 20 ? 0 + 'Pxs' : this.currentSpeed + 'Pxs');
    this._road.node.css({ '-webkit-transform': 'translate3D(0, ' + this._road.position.y + 'px, 0)' });
    this._grassLeft.node.css({ '-webkit-transform': 'translate3D(0, ' + this._grassLeft.position.y + 'px, 0)' });
    this._grassRight.node.css({ '-webkit-transform': 'translate3D(0, ' + this._grassRight.position.y + 'px, 0)' });
    this._car.node.css({ '-webkit-transform': 'translate3D(' + this._car.position.x + 'px, 0, 0) rotateZ(' + this._car.rotation + 'deg)' });

    if (this.obstaclesArray.length > 0) {
        for (var i = 0; i < this.obstaclesArray.length; i++) {
            this.obstaclesArray[i].node.css({ '-webkit-transform': 'translate3D(' + this.obstaclesArray[i].position.x + 'px, ' + this.obstaclesArray[i].position.y + 'px, 0)' });
        }
    }
};

Game.prototype.triggerObstacles = function () {
    var self = this,
        randomTimeOffset = getRandom(200,500),
        randomLane;

    setTimeout(function () {
        self.createObstacle();
        if (!self.stopObstacles) self.triggerObstacles();
    }, randomTimeOffset);
};

Game.prototype.createObstacle = function () {
    var obstacle,
        obstacleNode,
        type = getRandom(1,6),
        lane = getRandom(1,this._numLanes),
        speed;

    switch (type) {
        case 1:
            speed = 0;
            motion = 'static';
            break;
        case 2:
            speed = 0;
            motion = 'static';
            break;
        case 3:
            speed = 0;
            motion = 'static';
            break;
        case 4:
            speed = 50;
            motion = 'moving';
            break;
        case 5:
            speed = 80;
            motion = 'moving';
            break;
        case 6:
            speed = 100;
            motion = 'moving';
    }

    obstacleNode = $('<div></div>').addClass('obstacle').addClass('type-' + type);

    obstacle = {
        node: obstacleNode,
        type: type,
        lane: lane,
        motion: motion,
        position: { 
            x: (((lane - 1) * Math.round((this._gameWidth - (2 * this._grassWidth)) / this._numLanes))) + this._grassWidth + 2, 
            y: -50 
        },
        size: null,
        speed: speed
    };

    this.obstaclesArray.push(obstacle);
    this._gameContainer.append(obstacle.node);

    // getting size after the obstacle is in DOM
    obstacle.size = {
        width: parseInt(obstacleNode.width(), 10),
        height: parseInt(obstacleNode.width(), 10)
    };
};

Game.prototype.destroyObstacle = function (obstacleId) {
    this.obstaclesArray[obstacleId].node.remove();
    this.obstaclesArray.splice(obstacleId, 1);
};

Game.prototype.getCarRotation = function () {
    var carRotation = (this.carTwitching) ? this.wheelPosition + getRandom(-5,5) : this.wheelPosition;
    return Math.min(70, carRotation);
};

Game.prototype.getCarPosition = function () {
    return this.wheelPosition * (this.currentSpeed / this._carHandlingFactor);
};

Game.prototype.checkCollisions = function () {
    for (var i = 0; i < this.obstaclesArray.length; i++) {
        // get back center point of the obstacle
        var obstacleHitpoint = {
            x: Math.round(this.obstaclesArray[i].position.x + (this.obstaclesArray[i].size.width / 2)), // middle of the obstacle
            y: this.obstaclesArray[i].position.y + this.obstaclesArray[i].size.height // back of the obstacle
        };
        // get front center point of the car
        var carHitpoint = {
            x: Math.round(this._car.position.x + (this._car.size.width / 2)), // middle of the car
            y: this._car.position.y // front of the car
        };
        // if both center points are less than obstacle width away and car center point y coordinate is between obstacle y coordinate and obstacle's height trigger collision
        if (Math.abs(obstacleHitpoint.x - carHitpoint.x) < this.obstaclesArray[i].size.width && obstacleHitpoint.y - carHitpoint.y > 0 && obstacleHitpoint.y - carHitpoint.y < this.obstaclesArray[i].size.height) {
            if (!this.collisionDetected) {
                this.collisionDetected = true;
                // remember which obstacle is hit, we want to decrease life only once per obstacle
                this.obstacleHit = this.obstaclesArray[i];
                this.triggerCollision(this.obstaclesArray[i]);
            }
        } else if (this.obstacleHit === this.obstaclesArray[i]) {
            this.collisionDetected = false;
        }
    }
};

Game.prototype.triggerCollision = function (obstacle) {
    // decrease life and speed (speed is automatically increased to max speed)
    this.decreaseLife();
    this.speed = this._grassSpeed;

    if (this.life <= 0) {
        this.stopGame();
    }
};

Game.prototype.stopGame = function () {
    // stop the game and do a cleanup
    window.removeEventListener('deviceorientation', this.deviceOrientation);
    this.speed = 0;
    this.currentSpeed = 0;
    this.stopObstacles = true;
    this.gameRunning = false;
    alert('GAME OVER!');
};

/*
 * --- HELPER FUNCTIONS ---
 */

function percentToNumber (percent, total) {
    return Math.round(percent * total / 100);
}

function getRandom (from,to) {
    return Math.floor(Math.random() * (to - from + 1) + from);
}

function bind (ctx, fn) {
    return function () {
        fn.apply(ctx, arguments);
    };
}

(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = Date.now();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            lastTime = currTime + timeToCall;
            return window.setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
        };
 
    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());