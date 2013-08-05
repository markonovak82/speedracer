$(document).ready(function () {
	window.controls = new Controls();
});

function Controls () {
	this._slidingWindow = 3;
	this.wheelArray 	= [];
	this.socket 		= io.connect(window.location.hostname);

	window.addEventListener('deviceorientation', this.deviceOrientation.bind(this));
}

Controls.prototype.deviceOrientation = function (e) {
    var wheelTotal = 0;

    if (e.beta < 90 && e.beta > -90)
        this.wheelArray.push(e.beta);

    if (this.wheelArray.length > this._slidingWindow) 
        this.wheelArray.splice(0,1);

    for (var i = 0; i < this.wheelArray.length; i++) {
        wheelTotal += this.wheelArray[i];
    }

    this.wheelPosition = Math.round(wheelTotal / this.wheelArray.length);

	this.socket.emit('turning', { position: this.wheelPosition });
};