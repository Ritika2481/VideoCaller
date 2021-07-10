export default{
    shareScreen() {
    if ( this.userMediaAvailable() ) {
        return navigator.mediaDevices.getDisplayMedia( {
            video: {
                cursor: "always"
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        } );
    }

    else {
        throw new Error( 'User media not available' );
    }
},
replaceTrack( stream, recipientPeer ) {
    let sender = recipientPeer.getSenders ? recipientPeer.getSenders().find( s => s.track && s.track.kind === stream.kind ) : false;

    sender ? sender.replaceTrack( stream ) : '';
},



toggleShareIcons( share ) {
    let shareIconElem = document.querySelector( '#share-screen' );

    if ( share ) {
        shareIconElem.setAttribute( 'title', 'Stop sharing screen' );
        shareIconElem.children[0].classList.add( 'text-primary' );
        shareIconElem.children[0].classList.remove( 'text-white' );
    }

    else {
        shareIconElem.setAttribute( 'title', 'Share screen' );
        shareIconElem.children[0].classList.add( 'text-white' );
        shareIconElem.children[0].classList.remove( 'text-primary' );
    }
},
};