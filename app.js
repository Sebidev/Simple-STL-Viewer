var APP = {

	Player: function () {

		var renderer = new THREE.WebGLRenderer( { antialias: true } );
		renderer.setPixelRatio( window.devicePixelRatio ); // TODO: Use player.setPixelRatio()

		var loader = new THREE.ObjectLoader();
		var camera, scene;

		var events = {};

		var dom = document.createElement( 'div' );
		dom.appendChild( renderer.domElement );

		this.dom = dom;

		this.width = 500;
		this.height = 500;

		this.load = function ( json ) {

			var project = json.project;

			if ( project.shadows !== undefined ) renderer.shadowMap.enabled = project.shadows;
			if ( project.shadowType !== undefined ) renderer.shadowMap.type = project.shadowType;
			if ( project.toneMapping !== undefined ) renderer.toneMapping = project.toneMapping;
			if ( project.toneMappingExposure !== undefined ) renderer.toneMappingExposure = project.toneMappingExposure;

			this.setScene( loader.parse( json.scene ) );
			this.setCamera( loader.parse( json.camera ) );

			events = {
				init: [],
				start: [],
				stop: [],
				keydown: [],
				keyup: [],
				pointerdown: [],
				pointerup: [],
				pointermove: [],
				onWheel: [],
				update: []
			};

			var scriptWrapParams = 'player,renderer,scene,camera';
			var scriptWrapResultObj = {};

			for ( var eventKey in events ) {

				scriptWrapParams += ',' + eventKey;
				scriptWrapResultObj[ eventKey ] = eventKey;

			}

			var scriptWrapResult = JSON.stringify( scriptWrapResultObj ).replace( /\"/g, '' );

			for ( var uuid in json.scripts ) {

				var object = scene.getObjectByProperty( 'uuid', uuid, true );

				if ( object === undefined ) {

					console.warn( 'APP.Player: Script without object.', uuid );
					continue;

				}

				var scripts = json.scripts[ uuid ];

				for ( var i = 0; i < scripts.length; i ++ ) {

					var script = scripts[ i ];

					var functions = ( new Function( scriptWrapParams, script.source + '\nreturn ' + scriptWrapResult + ';' ).bind( object ) )( this, renderer, scene, camera );

					for ( var name in functions ) {

						if ( functions[ name ] === undefined ) continue;

						if ( events[ name ] === undefined ) {

							console.warn( 'APP.Player: Event type not supported (', name, ')' );
							continue;

						}

						events[ name ].push( functions[ name ].bind( object ) );

					}

				}

			}

			dispatch( events.init, arguments );

		};

		this.setCamera = function ( value ) {

			camera = value;
			camera.aspect = this.width / this.height;
			camera.updateProjectionMatrix();

		};

		this.setScene = function ( value ) {

			scene = value;

		};

		this.add = function ( value ) {

			scene.add(value);

		};

		this.setPixelRatio = function ( pixelRatio ) {

			renderer.setPixelRatio( pixelRatio );

		};

		this.setSize = function ( width, height ) {

			this.width = width;
			this.height = height;

			if ( camera ) {

				camera.aspect = this.width / this.height;
				camera.updateProjectionMatrix();

			}

			renderer.setSize( width, height );

		};

		function dispatch( array, event ) {

			for ( var i = 0, l = array.length; i < l; i ++ ) {

				array[ i ]( event );

			}

		}

		var time, startTime, prevTime;

		function animate() {

			time = performance.now();

			try {

				dispatch( events.update, { time: time - startTime, delta: time - prevTime } );

			} catch ( e ) {

				console.error( ( e.message || e ), ( e.stack || '' ) );

			}

			renderer.render( scene, camera );

			prevTime = time;

		}

		this.play = function () {

			startTime = prevTime = performance.now();

			document.addEventListener( 'keydown', onKeyDown );
			document.addEventListener( 'keyup', onKeyUp );
			document.addEventListener( 'pointerdown', onPointerDown );
			document.addEventListener( 'pointerup', onPointerUp );
			document.addEventListener( 'pointermove', onPointerMove );
			document.addEventListener( 'wheel', onWheel, false );
			

			dispatch( events.start, arguments );

			renderer.setAnimationLoop( animate );

		};

		this.stop = function () {

			document.removeEventListener( 'keydown', onKeyDown );
			document.removeEventListener( 'keyup', onKeyUp );
			document.removeEventListener( 'pointerdown', onPointerDown );
			document.removeEventListener( 'pointerup', onPointerUp );
			document.removeEventListener( 'pointermove', onPointerMove );
			document.removeEventListener( 'onWheel', onWheel );

			dispatch( events.stop, arguments );

			renderer.setAnimationLoop( null );

		};

		this.render = function ( time ) {

			dispatch( events.update, { time: time * 1000, delta: 0 /* TODO */ } );

			renderer.render( scene, camera );

		};

		this.dispose = function () {

			renderer.dispose();

			camera = undefined;
			scene = undefined;

		};

		//

		function onKeyDown( event ) {

			dispatch( events.keydown, event );

		}

		function onKeyUp( event ) {

			dispatch( events.keyup, event );
		}

		let isDragging = false;
		let prevMousePos = { x: 0, y: 0 };
		let rotationSpeed = 0.005; 
		let cameraDistance = 10;
		let theta = 0; 
		let phi = Math.PI / 2;

		
		function onPointerDown(event) {
			isDragging = true;
			prevMousePos.x = event.clientX;
			prevMousePos.y = event.clientY;
		
			// Kameraabstand basierend auf der aktuellen Kameraposition berechnen
			cameraDistance = camera.position.length();
		
			let spherical = new THREE.Spherical();
			spherical.setFromVector3(camera.position);
		
			theta = spherical.theta;
			phi = spherical.phi;
		
			dispatch(events.pointerdown, event);
		}
			
		
		function onPointerUp(event) {
			isDragging = false;
			dispatch(events.pointerup, event);
		}
		
		function onPointerMove(event) {
			if (isDragging) {
				let deltaX = event.clientX - prevMousePos.x;
				let deltaY = event.clientY - prevMousePos.y;
		
				theta -= deltaX * rotationSpeed;
				phi -= deltaY * rotationSpeed;
		
				// Begrenzung für phi, damit die Kamera nicht über den Polen hinausgeht
				phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));
		
				// Sphärisches Koordinatensystem
				let x = cameraDistance * Math.sin(phi) * Math.sin(theta);
				let y = cameraDistance * Math.cos(phi);
				let z = cameraDistance * Math.sin(phi) * Math.cos(theta);
		
				camera.position.set(x, y, z);
				camera.lookAt(new THREE.Vector3(0, 0, 0)); // Die Kamera schaut immer auf den Mittelpunkt
		
				// Mausposition für die nächste Bewegung aktualisieren
				prevMousePos.x = event.clientX;
				prevMousePos.y = event.clientY;
			}
		
			dispatch(events.pointermove, event);
		}		
		
		function onWheel(event) {
			const zoomFactor = 5.0;
			
			// Richtung vom Ursprung zur Kamera berechnen
			let direction = new THREE.Vector3().subVectors(camera.position, new THREE.Vector3(0, 0, 0)).normalize();
		
			if(event.deltaY > 0) {
				// Zoom heraus
				camera.position.add(direction.multiplyScalar(zoomFactor));
			} else {
				// Zoom hinein
				camera.position.sub(direction.multiplyScalar(zoomFactor));
			}
		
			dispatch(events.onWheel, event);
		}
			
	}

};

export { APP };
