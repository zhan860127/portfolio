export default defineOAuthGoogleEventHandler({
    async onSuccess(event, { user }) {
        await setUserSession(event, {
            user: {
                email: user.email,
                name: user.name,
                avatar: user.picture
            }
        })
        return sendRedirect(event, '/')
    },
    // Optional, will return a json error and 401 status code by default
    onError(event, error) {
        console.error('Google OAuth error:', error)
        return sendRedirect(event, '/')
    },
})
