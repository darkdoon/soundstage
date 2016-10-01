(function(window){
	
	var node = document.getElementById('canvas-0');
	var canvas = node.getContext('2d');

	var colors = [
		{ r: 140, g: 190, b: 100 },
		{ r: 180, g: 155, b: 100 },
		{ r: 140, g: 155, b: 140 }
	];

	var warningColor = 'red';

	function toX(seconds) {
		return seconds * 240;
	}

	function drawLabel(x, text, color) {
		canvas.font = "14px sans-serif";
		canvas.textBaseline = "hanging";
		canvas.fillStyle = color;
		canvas.fillText(text, x + 3, 3, 300);
	}

	function drawBar(x, y, color) {
		canvas.strokeStyle = color;
		canvas.lineWidth = 0.5;
		canvas.beginPath();
		canvas.moveTo(x, y);
		canvas.lineTo(x, node.height);
		canvas.closePath();
		canvas.stroke();
	}

	function drawRegion(x1, x2, y, color) {
		canvas.fillStyle = color;
		canvas.lineWidth = 0;
		canvas.beginPath();
		canvas.moveTo(x1, y);
		canvas.lineTo(x2, y);
		canvas.lineTo(x2, node.height);
		canvas.lineTo(x1, node.height);
		canvas.lineTo(x1, y);
		canvas.closePath();
		canvas.fill();
	}

	function drawLine(x1, x2, y, color) {
		canvas.strokeStyle = color;
		canvas.lineWidth = 1;
		canvas.beginPath();
		canvas.moveTo(x1, y);
		canvas.lineTo(x2, y);
		canvas.closePath();
		canvas.stroke();
	}

	function drawNoteEvent(x1, x2, y, color) {
		canvas.strokeStyle = color;
		canvas.lineWidth = 1;
		canvas.beginPath();
		canvas.moveTo(x1, y);
		canvas.lineTo(x2, y);
		canvas.closePath();
		canvas.stroke();
		
		canvas.fillStyle = color;
		canvas.beginPath();
		canvas.fillRect(x2, y - 3, 6, 6);
		//canvas.arc(x2, y, 3, 0, 2 * Math.PI, false);
		canvas.closePath();
		canvas.fill();
	}

	function drawNoteOffEvent(x1, x2, y, color) {
		canvas.strokeStyle = color;
		canvas.lineWidth = 1;
		canvas.beginPath();
		canvas.moveTo(x1, y);
		canvas.lineTo(x2, y);
		canvas.closePath();
		canvas.stroke();
		
		canvas.fillStyle = color;
		canvas.beginPath();
		canvas.strokeRect(x2, y - 3, 6, 6);
		canvas.closePath();
		canvas.fill();
	}

	function drawParamEvent(x1, x2, y, color) {
		canvas.strokeStyle = color;
		canvas.lineWidth = 1;
		canvas.beginPath();
		canvas.moveTo(x1, y);
		canvas.lineTo(x2, y);
		canvas.closePath();
		canvas.stroke();
		
		canvas.fillStyle = color;
		canvas.beginPath();
		canvas.arc(x2, y, 5, 0, 2 * Math.PI, false);
		canvas.closePath();
		canvas.fill();
	}

	function drawDeciSeconds() {
		var n = 300;
		while (n--) {
			drawBar(toX(n) / 10, 0, '#eaeaea');
		}
	}

	function drawSeconds() {
		var n = 30;
		while (n--) {
			drawBar(toX(n), 0, '#bbbbbb');
			drawLabel(toX(n), n + 's', '#bbbbbb');
		}
	}

	// Change the dimensions of our canvas
	node.width = 7200;
	node.height = 256;

	// Set colours and everything
	canvas.strokeStyle = 'black';
	canvas.fillStyle = "#808080";
	// Align single pixel strokes with the pixel grid
	canvas.translate(0.5, 0.5);
	canvas.lineCap = "butt";

	// Set up some shapes
	drawDeciSeconds();
	drawSeconds();

	var n = 0;
	var c = colors[0];
	var frameY = 20;

	window.graph = {
		drawCue: function(s1, s2) {
			n = (n + 1) % 3;
			c = colors[n];
			drawRegion(toX(s1), toX(s2), n * 4 + frameY, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.1)');
			drawLine(toX(s1), toX(s2),   n * 4 + frameY, 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')');
		},

		drawBar: function(seconds, color, text) {
			drawBar(toX(seconds), 0, color || 'blue');
			drawLabel(toX(seconds), Fn.isDefined(text) ? text : seconds.toFixed(3) + 's', color || 'blue');
		},

		drawEvent: function(s1, event) {
			var s2 = event[0];
			var type = event[1];
			var value;

			if (type === "param") {
				value = event[3];
				drawParamEvent(toX(s1), toX(s2), 256 * (1 - value), s2 < s1 ? warningColor : 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')');
			}
			else if (type === "noteoff") {
				value = event[2];
				drawNoteOffEvent(toX(s1), toX(s2), (128 - value) * 2, s2 < s1 ? warningColor : 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')');
			}
			else {
				value = event[2];
				drawNoteEvent(toX(s1), toX(s2), (128 - value) * 2, s2 < s1 ? warningColor : 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')');
			}
		}
	};
})(this);