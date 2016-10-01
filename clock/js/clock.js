(function(window) {
	"use strict";

	var assign           = Object.assign;
	var defineProperties = Object.defineProperties;

	var Fn               = window.Fn;
	var AudioObject      = window.AudioObject;
	var isAudioContext   = AudioObject.isAudioContext;
	var isDefined        = Fn.isDefined;

	function call(fn) {
		fn();
	}

	function UnityNode(audio) {
		var oscillator = audio.createOscillator();
		var waveshaper = audio.createWaveShaper();

		var curve = new Float32Array(2);
		curve[0] = curve[1] = 1;

		oscillator.type = 'square';
		oscillator.connect(waveshaper);
		oscillator.frequency.value = 100;
		waveshaper.curve = curve;
		oscillator.start();

		return waveshaper;
	}


	var cues = Fn.BufferStream();
	cues.each(call);

	function returnThis() { return this; }

	// CueTimer

	// Duration override when page is not visible and setTimeout is throttled.
	var hiddenDuration = 1.333333;
	
	// Duration override during elastic scrolling in Chrome.
	var scrollDuration = 0.666667;

	function CueTimer(duration, lookahead, now) {
		var playing   = false;
		var fns       = [];
		var cuetimer  = this;
		var timer, time;

		function fire(time) {
			// Swap fns so that frames are not pushing new requests to the
			// current fns list.
			var functions = fns;
			var fn;

			fns = [];

			// Do we need this? It's exposed for immediate scheduling...
			cuetimer.lastCueTime = time;

			for (fn of functions) {
				fn(time);
			}
		}

		function frame() {
			if (!fns.length) {
				playing = false;
				return;
			}

			var t = now();

			if (t > time) {
				console.warn('CueTimer: cue dropped at', t);
			}

			if (document.hidden) {
				var n = t + hiddenDuration;
				time = n > time ? n : time ;
				fire(time);
				// Delay should be 0, the browser will fire the timer as soon as
				// it can. However, let's give it some value to protect against
				// a fast timer loop. Shouldn't happen, but just in case.
				timer = setTimeout(frame, duration);
				return;
			}

			if (isScrolling()) {
				var n = t + scrollDuration;
				time = n > time ? n : time ;
			}
			else {
				time += duration;
			}

			fire(time);
			timer = setTimeout(frame, (time - now() - lookahead) * 1000);
		}

		function start() {
			time = now() + duration;
			playing = true;
			frame();
		}

		this.now = now;

		this.requestCue = function requestCue(fn) {
			fns.push(fn);
			if (!playing) { start(); }
		};

		this.cancelCue = function cancelCue(fn) {
			var i = fns.indexOf(fn);
			if (i > -1) { fns.splice(i, 1); }
		};

		var mousewheelTime = -Infinity;

		function isScrolling() {
			return now() < mousewheelTime + scrollDuration * 0.666667 ;
		}

		// Elastic scrolling in Chrome causes delays in setTimeout. Scroll
		// events don't necessarily fire so use wheel.
		// Todo: we don't appear to need this for FF or Safari.
		document.addEventListener('wheel', function(e) {
			graph.drawBar(now(), 'rgba(220,20,20,0.1)', '');

			// During a scroll use these mousewheel events as a timer, as
			// setTimeout becomes unreliable.
			if (!isScrolling()) {
				graph.drawBar(now(), 'red');
				mousewheelTime = now();
				clearTimeout(timer);
				frame();
			}
		});

		document.addEventListener('visibilitychange', function(e) {
			if (document.hidden) {
				clearTimeout(timer);
				frame();
			}
		});
	}


	// Clock

	function toBeat(time, startTime, data) {
		var b = 0;
		var r = 1;
		var t = 0;

		Fn(data)
		.filter(function(event) { return event[1] === 'rate'; })
		.sort(Fn.by(0))
		.filter(function(event) {
			var temp = t + (event[0] - b) / r;
			if (temp > (time - startTime)) { return false; }
			t = temp;
			return true;
		})
		.each(function(event) {
			b = event[0];
			r = event[2];
		});

		return b + (time - startTime - t) * r;
	}

	function toTime(beat, startTime, data) {
		var b = 0;
		var r = 1;
		var t = 0;

		Fn(data)
		.filter(Fn.compose(Fn.is('rate'), Fn.get(1)))
		.sort(Fn.by(0))
		.filter(function(event) {
			return event[0] < beat;
		})
		.each(function(event) {
			t += (event[0] - b) / r;
			b = event[0];
			r = event[2];
		});

		return startTime + t + (beat - b) /r;
	}

	function Clock(timer, audio, data) {
		// Support using constructor without the `new` keyword
		if (!Clock.prototype.isPrototypeOf(this)) {
			return new Clock(timer, audio, data);
		}

		var clock = this;
		var startTime = 0;
		var prevTime = 0;
		var now, getTime, timer;

		function beatAtTime(time) {
			return toBeat(time, startTime, data);
		}

		function timeAtBeat(beat) {
			return toTime(beat, startTime, data);
		}

		function cue(time) {
			Fn(data)
			.filter(Fn.compose(Fn.equals('rate'), Fn.get(1)))
			.map(function toTime(event) {
				var result = event.slice();
				result[0] = clock.timeAtBeat(event[0]);
				return result;
			})
			.filter(Fn.compose(function(t) {
				return prevTime <= t && t < time;
			}, Fn.get(0)))
			.each(function(event){
				clock.automate(event[1], event[2], event[0]);
			});

			prevTime = time;
			timer.requestCue(cue);
		}

		this.now        = Fn.compose(beatAtTime, timer.now);
		this.timeAtBeat = timeAtBeat;
		this.beatAtTime = beatAtTime;

		this.start = function start(time) {
			prevTime = startTime = Fn.isDefined(time) ?
				beatAtTime(time) :
				timer.now() ;

			this.stop = stop;

			timer.requestCue(cue);

			return this;
		};

		this.stop = function stop() {
			var beat = now();
			this.now = function() { return beat; };
			this.stop = returnThis;
			return this;
		};




		// Set up audio object params

		var unityNode    = UnityNode(audio);
		var rateNode     = audio.createGain();

		rateNode.channelCount = 1;
		rateNode.gain.setValueAtTime(1, startTime);
		unityNode.connect(rateNode);

		// Set up clock as an audio object with outputs "rate" and
		// "duration" and audio property "rate".
		AudioObject.call(this, audio, undefined, {
			rate: rateNode
		}, {
			rate: {
				set: function(value, time, curve, duration) {
					// For the time being, only support step changes to tempo
					if (curve !== 'step') { throw new Error('Clock: currently only supports "step" automations of rate.'); }

					AudioObject.automate(rateNode.gain, time, value, curve, duration);

					// A tempo change must be created where rate has been set
					// externally. Calls to addRate from within clock should
					// first set addRate to noop to avoid this.
					//addRate(clock, cues, time, value);
				},

				value: 1,
				curve: 'step'
			}
		});
	}

	Clock.prototype = Object.create(AudioObject.prototype);

	assign(Clock.prototype, {
		create: function(data) {
			return new Clock(this, data);
		}
	});

	assign(Clock, {
		lookahead: 0.1,
		frameDuration: 0.2
	});

	window.CueTimer = CueTimer;
	window.Clock = Clock;
})(this);