$(document).ready(function () {
	// create game object
    window.game = new Game();

    // init the game
	game.init();
});

/*
 * --- GAME OBJECT ---
 */

function Game (options) {
    // max car speed
    this._maxSpeed = 180;

    // max speed on grass
    this._grassSpeed = 120;

    // life or number of allowed hits
    this._fullLife = 10;

    // determines the steering of the car
    this._carHandlingFactor = 3000;

    // determines the acceleration of the car
    this._speedFactor = 5;

    // game container width
    this._gameWidth = $('.container').width();

    // game container height
    this._gameHeight = $('.container').height();

    // grass width to determine road width
    this._grassWidth = $('.grass').width();

    // number of different road lanes for obstacles
    this._numLanes = 12;

    // game nodes
    this._gameContainer   = $('.container');
    this._lifeBar         = $('.lifebar');
    this._startButton     = $('.menu a');
    this._playAgainButton = $('.end a');
    this._menu            = $('.menu');
    this._end             = $('.end');

    // socket io object
    this._socket             = io.connect(window.location.hostname);

    // road object
    this._road = {
        node: $('.road'),
        position: { x: 0, y: -1024 },
        size: { 
            width: parseInt($('.road').css('width'), 10), 
            height: 1024 
        }
    };

    // left grass object
    this._grassLeft = {
        node: $('.grass.left'),
        position: { x: null, y: -1024 },
        size: {
            width: parseInt($('.grass.left').css('width'), 10), 
            height: 1024
        }
    };

    // right grass object
    this._grassRight = {
        node: $('.grass.right'),
        position: { x: null, y: -1024 },
        size: {
            width: parseInt($('.grass.right').css('width'), 10), 
            height: 1024
        }
    };

    // car object
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

    // car hitpoint front center
    this._carHitpoint = {
        node: $('.car-hitpoint'),
        position: {
            x: Math.round(this._gameWidth / 2), 
            y: 300
        }
    };

    // explosion animation
    this._explosion = {
        node: $('.explosion'),
        position: {
            x: 0,
            y: 0
        },
        size: {
            width: parseInt($('.explosion').css('width'), 10), 
            height: parseInt($('.explosion').css('height'), 10)
        }
    };

    // speed gauge pointer which is rotated
    this._speedGaugePointer = {
        node: $('.speed-gauge img'),
        rotation: -90
    };

    // reset all dynamic values at the beginning
    this.reset();

    // start tick aka gameloop
    this.tick = this.tick.bind(this);
}

Game.prototype.reset = function () {
    this.speed              = 0;
    this.currentSpeed       = 0;
    this.stopObstacles      = true;
    this.gameRunning        = false;
    this.obstaclesTriggered = false;
    this.wheelPosition      = 0;
    this.speed              = 0;
    this.life               = this._fullLife;
    this.wheelArray         = [];
    this.obstaclesArray     = [];
    this.collisionDetected  = false;
    this.obstacleHit        = null;

    // remove all obstacles on the screen
    $('.obstacle').remove();
};

Game.prototype.init = function () {
    var self = this;

    // attach event listener to start button
    this._startButton.click(function(e){
        e.preventDefault();
        self.hideMenu();
        self.start();
    });

    // attach event listener to play again buton
    this._playAgainButton.click(function(e){
        e.preventDefault();
        self.hideEnd();
        self.start();
    });
};

Game.prototype.hideMenu = function () {
    this._menu.hide();
};

Game.prototype.hideEnd = function () {
    this._end.hide();
};

Game.prototype.showEnd = function () {
    this._end.show();
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

Game.prototype.start = function () {
    var self = this;

    // set car to the initial position
    this._car.node.css({ '-webkit-transform': 'translate3D(' + Math.round(this._gameWidth / 2) + 'px, 0, 0) rotateZ(0deg)' });
    this._car.position.x = Math.round(this._gameWidth / 2);
    this._car.rotation = 0;

    // fill life
    this.initLifeBar(this._fullLife);

    this.startTime = +new Date;

    this.gameRunning = true;
    this.stopObstacles = false;

    this._socket.on('wheel', function (data) {
        self.wheelPosition = data.position;    
    });

	this.tick();
};

Game.prototype.tick = function () {
    var drawn,
        elapsed,
        currentTime;

    if (this.gameRunning)
        this._rafId = requestAnimationFrame(this.tick);

    currentTime = +new Date;
    if (this.lastUpdateTime == null)
        this.lastUpdateTime = currentTime;

    elapsed = currentTime - this.lastUpdateTime;

    // update physics
    this.update(elapsed);

    // redraw all objects positions
    this.draw();
        
    this.lastUpdateTime = currentTime;    
};

Game.prototype.update = function (elapsed) {
    if (this.speed < this._maxSpeed && !this.carTwitching) {
        this.speed += 1;
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

            // update obstacle y position
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

    // position explosion
    this._explosion.position = {
        x: this._car.position.x - this._explosion.size.width / 2 + this._car.size.width / 2,
        y: this._car.position.y,
    }

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
    // rotate speedometer pin
    this.currentSpeed < 20 ? 0 : this.currentSpeed;
    this._speedGaugePointer.node.css({ '-webkit-transform': 'rotate(' + (this._speedGaugePointer.rotation + this.currentSpeed) + 'deg)' });

    this._road.node.css({ '-webkit-transform': 'translate3D(0, ' + this._road.position.y + 'px, 0)' });
    this._grassLeft.node.css({ '-webkit-transform': 'translate3D(0, ' + this._grassLeft.position.y + 'px, 0)' });
    this._grassRight.node.css({ '-webkit-transform': 'translate3D(0, ' + this._grassRight.position.y + 'px, 0)' });
    this._car.node.css({ '-webkit-transform': 'translate3D(' + this._car.position.x + 'px, 0, 0) rotateZ(' + this._car.rotation + 'deg)' });
    this._explosion.node.css({ '-webkit-transform': 'translate3D(' + this._explosion.position.x + 'px, ' + this._explosion.position.y + 'px, 0)' });

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
            // + 5 because of the lane's lines
            x: (((lane - 1) * Math.round((this._gameWidth - (2 * this._grassWidth)) / this._numLanes))) + this._grassWidth + 5, 
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
    return Math.min(70, carRotation / 2);
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
            // middle of the car
            x: Math.round(this._car.position.x + (this._car.size.width / 2)),
            // front of the car
            y: this._car.position.y
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
    } else {
        this.playCollisionAnimation();
    } 
};

Game.prototype.playCollisionAnimation = function () {
    var self = this;

    this._explosion.node.addClass('animated');
    this._explosion.node.on('webkitAnimationEnd oanimationend msAnimationEnd animationend', function(e) {
        self._explosion.node.removeClass('animated');
    });
};

Game.prototype.stopGame = function () {
    // stop the game and do a cleanup
    window.removeEventListener('deviceorientation', this.deviceOrientation);
    this.reset();
    this.showEnd();
};