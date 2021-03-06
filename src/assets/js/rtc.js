import sscreen from './sharescreen.js';
import media from './media.js';
import chat from './chat.js';

window.addEventListener( 'load', () => {
    const room = media.getQString( location.href, 'room' );
    const username = sessionStorage.getItem( 'username' );
    const usertype = sessionStorage.getItem( 'usertype' );

    if ( !room ) {
        document.querySelector( '#room-create' ).attributes.removeNamedItem( 'hidden' );
    }

    else if ( !username ) {
        document.querySelector( '#username-set' ).attributes.removeNamedItem( 'hidden' );
    }

    else { 
        showCommElements();
        var pc = [];

        let socket = io( '/stream' );

        var socketId = '';
        var screen = '';
        var myStream = '';

        //Get user video by default
        getAndSetUserStream();


        socket.on( 'connect', () => {
            //set socketId
            socketId = socket.io.engine.id;


            socket.emit( 'subscribe', {
                room: room,
                socketId: socketId
            } );


            socket.on( 'new user', ( data ) => {
                socket.emit( 'newUserStart', { to: data.socketId, sender: socketId } );
                pc.push( data.socketId );
                init( true, data.socketId );
            } );


            socket.on( 'newUserStart', ( data ) => {
                pc.push( data.sender );
                init( false, data.sender );
            } );


            socket.on( 'ice candidates', async ( data ) => {
                data.candidate ? await pc[data.sender].addIceCandidate( new RTCIceCandidate( data.candidate ) ) : '';
            } );


            socket.on( 'sdp', async ( data ) => {
                if (usertype === 'chat') {
                    return;
                }    
                if ( data.description.type === 'offer' ) {
                    data.description ? await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) ) : '';

                    media.getUserFullMedia().then( async ( stream ) => {
                        if ( !document.getElementById( 'local' ).srcObject ) {
                            media.setLocalStream( stream );
                        }

                        //save my stream
                        myStream = stream;

                        stream.getTracks().forEach( ( track ) => {
                            pc[data.sender].addTrack( track, stream );
                        } );

                        let answer = await pc[data.sender].createAnswer();

                        await pc[data.sender].setLocalDescription( answer );

                        socket.emit( 'sdp', { description: pc[data.sender].localDescription, to: data.sender, sender: socketId } );
                    } ).catch( ( e ) => {
                        console.error( e );
                    } );
                }

                else if ( data.description.type === 'answer' ) {
                    await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) );
                }
            } );


            socket.on( 'chat', ( data ) => {
                chat.addChat( data, 'remote' );
            } );
        } );

        function showCommElements() {
            if (usertype === 'chat'){
                showChatCommElements();
            } else {
                showCallCommElements();
            }
            const commElem = document.getElementsByClassName( 'room-comm' ); 
            for ( let i = 0; i < commElem.length; i++ ) {
                if (commElem[i].attributes.getNamedItem( 'hidden' ))
                    commElem[i].attributes.removeNamedItem( 'hidden' );
            }
        }
        function showChatCommElements() {
            const chatElem = document.querySelector( '#chat-pane' );
            chatElem.attributes.removeNamedItem( 'hidden' );
            chatElem.classList.add( 'chat-opened' );
            const chatCommElem = document.getElementsByClassName( 'chat-comm' );
            for ( let i = 0; i < chatCommElem.length; i++ ) {
                if (chatCommElem[i].attributes.getNamedItem( 'hidden' ))
                    chatCommElem[i].attributes.removeNamedItem( 'hidden' );
            }        
            const callCommElem = document.getElementsByClassName( 'call-comm' );
            for ( let i = 0; i < callCommElem.length; i++ ) {
                callCommElem[i].setAttribute( 'hidden', true );
            }   
        }
        function showCallCommElements() {
            const callCommElem = document.getElementsByClassName( 'call-comm' );
            for ( let i = 0; i < callCommElem.length; i++ ) {
                if (callCommElem[i].attributes.getNamedItem( 'hidden' ))
                    callCommElem[i].attributes.removeNamedItem( 'hidden' );
            }
            const chatCommElem = document.getElementsByClassName( 'chat-comm' );
            for ( let i = 0; i < chatCommElem.length; i++ ) {
                chatCommElem[i].setAttribute( 'hidden', true );
            }
            const chatElem = document.querySelector( '#chat-pane' );
            chatElem.classList.remove( 'chat-opened' );
        }


        function getAndSetUserStream() {
            if (usertype === 'chat') {
                return;
            }
            media.getUserFullMedia().then( ( stream ) => {
                //save my stream
                myStream = stream;

                media.setLocalStream( stream );
            } ).catch( ( e ) => {
                console.error( `stream error: ${ e }` );
            } );
        }


        function sendMsg( msg ) {
            let data = {
                room: room,
                msg: msg,
                sender: username
            };

            //emit chat message
            socket.emit( 'chat', data );

            //add localchat
            chat.addChat( data, 'local' );
        }



        function init( createOffer, partnerName ) {
            pc[partnerName] = new RTCPeerConnection( media.getIceServer() );

            if ( screen && screen.getTracks().length ) {
                screen.getTracks().forEach( ( track ) => {
                    pc[partnerName].addTrack( track, screen );//should trigger negotiationneeded event
                } );
            }

            else if ( myStream ) {
                myStream.getTracks().forEach( ( track ) => {
                    pc[partnerName].addTrack( track, myStream );//should trigger negotiationneeded event
                } );
            }

            else {
                if (usertype === 'chat') {
                    return;
                }
                media.getUserFullMedia().then( ( stream ) => {
                    //save my stream
                    myStream = stream;

                    stream.getTracks().forEach( ( track ) => {
                        pc[partnerName].addTrack( track, stream );//should trigger negotiationneeded event
                    } );

                    media.setLocalStream( stream );
                } ).catch( ( e ) => {
                    console.error( `stream error: ${ e }` );
                } );
            }



            //create offer
            if ( createOffer ) {
                pc[partnerName].onnegotiationneeded = async () => {
                    let offer = await pc[partnerName].createOffer();

                    await pc[partnerName].setLocalDescription( offer );

                    socket.emit( 'sdp', { description: pc[partnerName].localDescription, to: partnerName, sender: socketId } );
                };
            }



            //send ice candidate to partnerNames
            pc[partnerName].onicecandidate = ( { candidate } ) => {
                socket.emit( 'ice candidates', { candidate: candidate, to: partnerName, sender: socketId } );
            };



            //add
            pc[partnerName].ontrack = ( e ) => {
                let str = e.streams[0];
                if ( document.getElementById( `${ partnerName }-video` ) ) {
                    document.getElementById( `${ partnerName }-video` ).srcObject = str;
                }

                else {
                    //video elem
                    let newVid = document.createElement( 'video' );
                    newVid.id = `${ partnerName }-video`;
                    newVid.srcObject = str;
                    newVid.autoplay = true;
                    newVid.className = 'remote-video';

                    //video controls elements
                    let controlDiv = document.createElement( 'div' );
                    controlDiv.className = 'remote-video-controls';
                    controlDiv.innerHTML = `<i class="fa fa-microphone text-white pr-3 mute-remote-mic" title="Mute"></i>
                        <i class="fa fa-expand text-white expand-remote-video" title="Expand"></i>`;

                    //create a new div for card
                    let cardDiv = document.createElement( 'div' );
                    cardDiv.className = 'card card-sm';
                    cardDiv.id = partnerName;
                    cardDiv.appendChild( newVid );
                    cardDiv.appendChild( controlDiv );

                    //put div in main-section elem
                    document.getElementById( 'videos' ).appendChild( cardDiv );

                    media.adjustVideoElemSize();
                }
            };



            pc[partnerName].onconnectionstatechange = ( d ) => {
                switch ( pc[partnerName].iceConnectionState ) {
                    case 'disconnected':
                    case 'failed':
                        media.closeVideo( partnerName );
                        break;

                    case 'closed':
                        media.closeVideo( partnerName );
                        break;
                }
            };



            pc[partnerName].onsignalingstatechange = ( d ) => {
                switch ( pc[partnerName].signalingState ) {
                    case 'closed':
                        console.log( "Signalling state is 'closed'" );
                        media.closeVideo( partnerName );
                        break;
                }
            };
        }
        
        function broadcastNewTracks( stream, type, mirrorMode = true ) {
            media.setLocalStream( stream, mirrorMode );

            let track = type == 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

            for ( let p in pc ) {
                let pName = pc[p];

                if ( typeof pc[pName] == 'object' ) {
                    media.replaceTrack( track, pc[pName] );
                }
            }
        }

        function shareScreen() {
        media.shareScreen().then( ( stream ) => {
                sscreen.toggleShareIcons( true );
                media.toggleVideoBtnDisabled( true );
                screen = stream;
                //show shared screen to all participants
                broadcastNewTracks( stream, 'video', false );
                screen.getVideoTracks()[0].addEventListener( 'ended', () => {
                    stopSharingScreen();
                } );
            } ).catch( ( e ) => {
                console.error( e );
            } );
        }



        function stopSharingScreen() {
            //enable video toggle btn
        media.toggleVideoBtnDisabled( false );

            return new Promise( ( res, rej ) => {
                screen.getTracks().length ? screen.getTracks().forEach( track => track.stop() ) : '';

                res();
            } ).then( () => {
            sscreen.toggleShareIcons( false );
                broadcastNewTracks( myStream, 'video' );
            } ).catch( ( e ) => {
                console.error( e );
            } );
        }

        //Chat textarea
        document.getElementById( 'chat-input' ).addEventListener( 'keypress', ( e ) => {
            if ( e.which === 13 && ( e.target.value.trim() ) ) {
                e.preventDefault();

                sendMsg( e.target.value );

                setTimeout( () => {
                    e.target.value = '';
                }, 50 );
            }
        } );      
          
        document.getElementById( 'toggle-video' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();


            sessionStorage.setItem( 'usertype', 'chat' );
            let elem = document.getElementById( 'toggle-video' );

            if ( myStream.getVideoTracks()[0].enabled ) {
                e.target.classList.remove( 'fa-video' );
                e.target.classList.add( 'fa-video-slash' );
                elem.setAttribute( 'title', 'Show Video' );

                myStream.getVideoTracks()[0].enabled = false;
            }

            else {
                e.target.classList.remove( 'fa-video-slash' );
                e.target.classList.add( 'fa-video' );
                elem.setAttribute( 'title', 'Hide Video' );

                myStream.getVideoTracks()[0].enabled = true;
            }

            broadcastNewTracks( myStream, 'video' );
        } );

        document.getElementById( 'leave-call' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();

            if ( myStream.getVideoTracks() ) {
                myStream.getVideoTracks()[0].enabled = false;
                myStream.getVideoTracks()[0].srcObject = null;
                broadcastNewTracks( myStream, 'video' );
                const localStream = document.getElementById("local");
                if (localStream) {
                    localStream.srcObject = null;               
                }
            }
            for ( let participant in pc ) {
                const partnerName = pc[participant];
                const partnerStream = document.getElementById( `${ partnerName }-video` );
                if (partnerStream) {
                    partnerStream.srcObject = null;
                    partnerStream.remove();
                }
            }
            showChatCommElements();
        } );

        //When the mute icon is clicked
        document.getElementById( 'toggle-mute' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();

            let elem = document.getElementById( 'toggle-mute' );

            if ( myStream.getAudioTracks()[0].enabled ) {
                e.target.classList.remove( 'fa-microphone-alt' );
                e.target.classList.add( 'fa-microphone-alt-slash' );
                elem.setAttribute( 'title', 'Unmute' );

                myStream.getAudioTracks()[0].enabled = false;
            }

            else {
                e.target.classList.remove( 'fa-microphone-alt-slash' );
                e.target.classList.add( 'fa-microphone-alt' );
                elem.setAttribute( 'title', 'Mute' );

                myStream.getAudioTracks()[0].enabled = true;
            }

            broadcastNewTracks( myStream, 'audio' );
        } );

        //when share screen button will be clicked
        document.getElementById( 'share-screen' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();

            if ( screen && screen.getVideoTracks().length && screen.getVideoTracks()[0].readyState != 'ended' ) {
                stopSharingScreen();
            }

            else {
                shareScreen();
            }
        } );
    }
} );
