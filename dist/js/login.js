// Version 1.2.1
/**
 * LOGIN
 */

const SERVER_URL = config.serverUrl
const LOGIN_REDIRECT_URL = config.login.redirectUrl
const GROUP_ALIAS = config.groupAlias
const URL_QUERY = new URLSearchParams(window.location.search)

// Elements
const loginForm = document.getElementById("login-form")
const loginButton = document.getElementById("login-button")
const loginGuest = document.getElementById("login-guest-button")
const loginSSOButton = document.getElementById("login-sso-button")
const loginNotice = document.getElementById("login-notice")
const forgotLink = document.getElementById("forgot-link")
const createLink = document.getElementById("create-link")
const copyright = document.querySelector(".login-copyright")

// Error Messages
const genericErrorMessage = "There has been an issue."
const clientErrorMessage = "Cannot access client."
const privateErrorMessage = "Please use a non-private window."

// DriveWorks Live Client
let client;

	/**
	 * On page load.
	 */
(async function () {
	setLoginCover()
	addCarouselImages()

	loginForm.addEventListener("submit", handleLoginForm)

	if (loginSSOButton) {
		if (config.allowSingleSignOn) {
			loginSSOButton.addEventListener("click", handleLoginSSO)
		} else {
			loginSSOButton.style.display = "none"
		}
	}

	if (loginGuest) {
		if (config.allowGuestLogin) {
			loginGuest.addEventListener("click", handleGuestLogin)
		} else {
			loginGuest.style.display = "none"
		}
	}

	if (forgotLink) {
		if (!config.accountManagement.allowForgotPassword) {
			forgotLink.style.display = "none"
		}
	}

	if (createLink) {
		if (!config.accountManagement.allowCreateAccount) {
			createLink.style.display = "none"
		}
	}
	showLoginNotice()
	setLoginColumnLocation()
	setCopright()
})()

/**
 * Create client.
 */
async function dwClientLoaded() {
	try {
		client = new window.DriveWorksLiveClient(SERVER_URL)
	} catch (error) {
		loginError(clientErrorMessage, error)
	}

	// Quick Logout (?bye)
	// https://docs.driveworkspro.com/Topic/WebThemeLogout
	if (URL_QUERY.has("bye")) {
		await forceLogout()
	}

	startPageFunctions()
}

/**
 * Start page functions.
 */
function startPageFunctions() {
	handlePasswordToggle()

	// Check localStorage support (show warning if not e.g. <= iOS 10 Private Window)
	if (!localStorageSupported()) {
		document.getElementById("login-button").disabled = true
		loginError(privateErrorMessage)
		return
	}

	try {
		// Check if logged in, and redirect
		checkExistingLogin()
	} catch (error) {
		handleGenericError(error)
	}
}

async function login(type, event = null) {
	if (event) {
		event.preventDefault()
	}

	// Show error if cannot connect to client
	if (!client) {
		loginError(clientErrorMessage)
		return
	}

	try {
		// Show loading state, reset notice
		loginButton.classList.add("is-loading")
		hideLoginNotice()

		// Start Session
		if (type === "default" || type === null || type === "") {
			// Get credentials
			const inputUsername =
				document.getElementById("login-username").value
			const inputPassword =
				document.getElementById("login-password").value
			const userCredentials = {
				username: inputUsername,
				password: inputPassword,
			}
			const result = await client.loginGroup(GROUP_ALIAS, userCredentials)
		} else if (type === "SSO") {
			const result = await client.loginSSO(GROUP_ALIAS)
		} else if (type === "Guest") {
			await client.loginGroup(GROUP_ALIAS)
		}

		// Show error is login failed
		if (!result) {
			loginError(genericErrorMessage)
			return
		}

		loginSuccess(result, inputUsername)
	} catch (error) {
		loginError(genericErrorMessage, error)
	}
}

function handleLoginForm(event) {
	login("default", event)
}

function handleGuestLogin() {
	login("Guest")
}

function handleLoginSSO() {
	login("SSO")
}

/**
 * Handle successful login. Store Session data to localStorage & redirect.
 */
function loginSuccess(result, username) {
	// Store session details to localStorage
	localStorage.setItem("sessionId", result.sessionId)
	localStorage.setItem("sessionAlias", GROUP_ALIAS)

	if (username) {
		localStorage.setItem("sessionUsername", username)
	}

	// Return to previous location (if redirected to login)
	const returnUrl = URL_QUERY.get("returnUrl")

	if (returnUrl && config.loginReturnUrls) {
		window.location.href = `${window.location.origin}/${decodeURIComponent(
			returnUrl,
		)}`
		return
	}

	// Redirect to default location
	window.location.href = LOGIN_REDIRECT_URL
}

/**
 * Handle login errors.
 *
 * @param {string} noticeText - The message to display when directed to the login screen.
 * @param {Object} [error] - The error object.
 */
function loginError(noticeText, error = null) {
	if (error) {
		handleGenericError(error)
	}

	// Remove loading state
	loginButton.classList.remove("is-loading")

	// Show client error
	setLoginNotice(noticeText, "error")
	showLoginNotice()
}

/**
 * Set login screen notice.
 *
 * @param {string} text - The message to display when directed to the login screen.
 * @param {string} [state] - The type of message state (error/success/info).
 */
function setLoginNotice(text, state = "info") {
	const notice = JSON.stringify({text: text, state: state})
	localStorage.setItem("loginNotice", notice)
}

/**
 * Show notice on login form.
 */
function showLoginNotice() {
	const notice = JSON.parse(localStorage.getItem("loginNotice"))

	if (!notice) {
		return
	}

	let state = notice.state

	if (!state) {
		state = "neutral"
	}

	// Display feedback
	loginNotice.innerText = notice.text
	loginNotice.classList.remove("error", "success", "neutral")
	loginNotice.classList.add(state, "is-shown")

	// Clear message
	localStorage.removeItem("loginNotice")
}

/**
 * Hide notice on login form.
 */
function hideLoginNotice() {
	loginNotice.classList.remove("is-shown")
}

/**
 * Handle password visibility toggle.
 */
function handlePasswordToggle() {
	const passwordToggle = document.getElementById("password-toggle")

	passwordToggle.onclick = function () {
		const passwordInput = document.getElementById("login-password")
		const currentType = passwordInput.type

		if (currentType === "password") {
			passwordInput.type = "text"
			passwordToggle.innerHTML =
				'<svg class="icon"><use xlink:href="dist/icons.svg#eye-closed"/></svg> Hide'
			return
		}

		passwordInput.type = "password"
		passwordToggle.innerHTML =
			'<svg class="icon"><use xlink:href="dist/icons.svg#eye-open"/></svg> Show'
	}
}

/**
 * Check existing login. Automatically login if found.
 */
async function checkExistingLogin() {
	const storedGroupAlias = localStorage.getItem("sessionAlias")

	if (!storedGroupAlias) {
		return
	}

	try {
		// Test connection
		await client.getProjects(storedGroupAlias, "$top=1")

		// Redirect to initial location
		window.location.replace(LOGIN_REDIRECT_URL)
	} catch (error) {
		handleGenericError(error)
	}
}

/**
 * Force logout and session data clearing.
 */
async function forceLogout() {
	// Logout from all Groups.
	try {
		await client.logoutAllGroups()
	} catch (error) {
		handleGenericError(error)
	}

	// Clear session information from storage.
	localStorage.clear()

	// Show login screen message.
	setLoginNotice("You have been logged out.", "success")
	showLoginNotice()
}

/**
 * Check for localStorage support - used to store session information.
 * Example: Incognito (Private) windows in iOS 10 and below do not allow localStorage, errors when accessed.
 */
function localStorageSupported() {
	try {
		localStorage.setItem("storageSupportTest", "Test")
		localStorage.removeItem("storageSupportTest")
		return true
	} catch (e) {
		return false
	}
}

/**
 * Handle generic errors e.g. tryCatch.
 *
 * @param {Object} error - The error object.
 */
function handleGenericError(error) {
	console.log(error)
}

/**
 * Set the loginCover
 */
function setLoginCover() {
	if (config.images.loginCover) {
		document.documentElement.style.setProperty(
			"--background-image",
			`url(${"../../../" + config.images.loginCover})`,
		)
	}
}

function setLoginColumnLocation() {
	if (!config.login.columnLocation) {
		return
	}

	if (config.login.columnLocation === "") {
		return
	}

	const loginContainer = document.querySelector(".login-container")

	if (config.login.columnLocation === "left") {
		loginContainer.style.flexDirection = "row"
		return
	}

	if (config.login.columnLocation === "right") {
		loginContainer.style.flexDirection = "row-reverse"
		return
	}

	if (config.login.columnLocation === "center") {
		const loginForm = loginContainer.querySelector("#login-form")
		const loginCover = loginContainer.querySelector(".login-cover")
		loginContainer.style.justifyContent = "center"
		loginContainer.style.backgroundImage = config.images.loginCover

		loginCover.style.display = "none"

		return
	}
}

function addCarouselImages() {
	if (!config.images.carousel || config.images.carousel.enabled === false) {
		return
	}

	const loginCover = document.querySelector(".login-cover")

	config.images.carousel.images.forEach((image) => {
		const img = document.createElement("img")
		img.src = image
		loginCover.appendChild(img)
	})

	loginCover.firstElementChild.classList.add("active")

	interval = 7500

	if (config.images.carousel.interval) {
		interval = config.images.carousel.interval * 1000
	}

	// call the transitionImages function every X seconds (milliseconds)
	setInterval(transitionImages, interval)
}

// a function to transition the opacity of the images every X seconds
function transitionImages() {
	const images = document.querySelectorAll(".login-cover img")
	const activeImage = document.querySelector(".login-cover img.active")

	// get the index of the active image
	const activeIndex = Array.from(images).indexOf(activeImage)

	// remove the active class from the active image
	activeImage.classList.remove("active")

	// get the next image in the array
	const nextImage = images[(activeIndex + 1) % images.length]

	// add the active class to the next image
	nextImage.classList.add("active")
}

// function to set the copyright information
function setCopright() {
	if (!copyright || !config.copyright.show) {
		// nothing to do if the copyright div can't be found
		// or if the config.copyright.show doesn't exist
		// or if config.copyright.show is false
		return
	}

	// otherwise, set the text
	copyright.innerText =
		config.copyright.holder + " - " + config.copyright.year
}
