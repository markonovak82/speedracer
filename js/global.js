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
    this.speed              = 200;
    this.speedArray         = [];
    this.wheelArray         = [];
    this.obstaclesArray     = [];
    this._slidingWindow     = 3;
    this._speedMax          = 200;
    this._speedMin          = 50;
    this._carHandlingFactor = 2000;
    this._carSteeringFactor = 120;
    this._speedFactor       = 5;
    this._gameWidth         = $(document).width();
    this._gameHeight        = $(document).height();
    this._grassWidth        = $('.grass').width();
    this._numLanes          = 12;
    this._gameContainer     = $('.container');
    this.stopObstacles      = false;

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
        position: { 
            x: Math.round(this._gameWidth / 2), 
            y: parseInt($('.car').css('bottom'), 10) 
        },
        size: { 
            width: parseInt($('.car').css('width'), 10),
            height: parseInt($('.car').css('height'), 10)
        },
        rotation: 0
    };
    this._speedometer = {
        node: $('.speed')
    };

    this.tick = bind(this, this.tick);
}

Game.prototype.init = function () {
	// getting orientation data from window
	window.addEventListener('deviceorientation', this.deviceOrientation.bind(this));

	this.start();
};

Game.prototype.deviceOrientation = function (e) {
    var currentSpeed,
        speedTotal = 0,
        wheelTotal = 0;

    // if (e.gamma < -45 && e.gamma > -90) {
    //     this.speedArray.push(Math.round((90 + e.gamma) * this._speedFactor));
        
    //     if (this.speedArray.length > this._slidingWindow) this.speedArray.splice(0,1);
        
    //     for (var i = 0; i < this.speedArray.length; i++) {
    //         speedTotal += this.speedArray[i];
    //     }

    //     this.speed = Math.min(200, Math.max(50, Math.round(speedTotal / this.speedArray.length)));
    // }

    if (e.beta < 90 && e.beta > -90)
        this.wheelArray.push(e.beta);

        if (this.wheelArray.length > this._slidingWindow) this.wheelArray.splice(0,1);

        for (var i = 0; i < this.wheelArray.length; i++) {
            wheelTotal += this.wheelArray[i];
        }

        this.wheelPosition = Math.round(wheelTotal / this.wheelArray.length);
};

Game.prototype.start = function () {
    this.startTime = +new Date;

    this.triggerObstacles();

	this.tick();
};

Game.prototype.tick = function () {
    var drawn,
        elapsed,
        currentTime,
        countdownTime;

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
    // car on grass
    if (this._car.position.x < this._grassWidth - Math.round(this._car.size.width / 2) || this._car.position.x > this._gameWidth - this._grassWidth - Math.round(this._car.size.width / 2)) {
        this.currentSpeed = Math.round(this.speed / 1.5);
        this.carTwitching = true;
    } else {
        this.currentSpeed = this.speed;
        this.carTwitching = false;
    }

    // update obstacles
    if (this.obstaclesArray.length > 1) {
        for (var i = 0; i < this.obstaclesArray.length; i++) {
            this.obstaclesArray[i].position.y += Math.round((this.currentSpeed * elapsed) / 1000);
            if (this.obstaclesArray[i].position.y > this._gameHeight) {
                this.obstaclesArray[i].node.remove();
                this.obstaclesArray.splice(i, 1);
            }
        }
    }

    // update road position
    this._road.position.y += Math.round((this.currentSpeed * elapsed) / 1000);
    if (this._road.position.y >= 0)
        this._road.position.y = -this._road.size.height;

    // update grass position
    this._grassLeft.position.y += Math.round((this.currentSpeed * elapsed) / 1000);
    if (this._grassLeft.position.y >= 0)
        this._grassLeft.position.y = -this._grassLeft.size.height;

    this._grassRight.position.y += Math.round((this.currentSpeed * elapsed) / 1000);
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
        randomTimeOffset = getRandom(100,400),
        randomLane;

    setTimeout(function () {
        self.createObstacle();

        if (!self.stopObstacles) self.triggerObstacles();
    }, randomTimeOffset);
};

Game.prototype.createObstacle = function () {
    var obstacle,
        type = getRandom(1,5),
        lane = getRandom(1,this._numLanes);

    obstacle = {
        node: $('<div></div>').addClass('obstacle').addClass('type-' + type),
        type: type,
        lane: lane,
        position: { x: (((lane - 1) * Math.round((this._gameWidth - (2 * this._grassWidth)) / this._numLanes))) + this._grassWidth, y: -50 },
        speed: type == 5 ? 80 : 0
    };

    this.obstaclesArray.push(obstacle);
    this._gameContainer.append(obstacle.node);
};

Game.prototype.destroyObstacle = function (obstacleId) {

};

Game.prototype.getCarRotation = function () {
    var carRotation;

    if (this.carTwitching)
        carRotation = this.wheelPosition + getRandom(-5,5);
    else
        carRotation = this.wheelPosition;

    return Math.min(70, carRotation);
};

Game.prototype.getCarPosition = function () {
    return this.wheelPosition * (this.currentSpeed / this._carHandlingFactor);
};

Game.prototype.checkCollision = function (obstacle) {
    // check collisions
};

Game.prototype.setCarPosition = function () {
    this._car.position.x = Math.round(this._gameWidth / 2);
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