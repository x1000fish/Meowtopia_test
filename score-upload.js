async function uploadScoreToSheet(endpoint, payload) {
    const username = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser') || payload.username || '';
    const isGuest = sessionStorage.getItem('isGuest') === 'true' || !username || username.toLowerCase() === 'guest';
    if (isGuest) {
        const error = new Error('Sign in to save scores to the leaderboard.');
        console.warn(error.message);
        throw error;
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify({ ...payload, username })
        });
        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        } catch {
            result = { status: responseText.trim() };
        }

        if (!response.ok || result.status !== 'success') {
            throw new Error(result.message || result.status || `HTTP ${response.status}`);
        }
        return result;
    } catch (error) {
        console.error('Score upload failed:', error);
        const listArea = document.getElementById('rankList');
        if (listArea) {
            listArea.innerHTML = '<p class="text-center italic text-red-400 mt-6 text-sm">Score save failed. Check connection or login, then try again.</p>';
        }
        throw error;
    }
}
