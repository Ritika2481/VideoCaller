export default{
 
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