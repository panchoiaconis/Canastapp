// ... existing code up to line 110
seedDemoData();

// Firebase auth state listener
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log('User is logged in, preventing demo data load.');
    } else {
        console.log('No user logged in, loading demo data.');
        seedDemoData();
    }
});

// Improved loginGoogle function
function loginGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            // User signed in
        })
        .catch((error) => {
            console.error('Error during Google login:', error);
            // Handle the error appropriately without falling back to demo data
        });
}
// ... remaining code