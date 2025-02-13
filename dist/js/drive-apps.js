// Version 1.3.1
/**
 * PROJECTS
 */

const CREDENTIALS = config.credentials
const driveAppList = document.getElementById("drive-app-list")
const profileButton = document.getElementById("profileButton")
const dropdownMenu = document.getElementById("dropdownMenu")

// Handle profile dropdown
if (profileButton && dropdownMenu) {
	profileButton.addEventListener('click', function(e) {
		e.preventDefault();
		dropdownMenu.classList.toggle('show');
	});

	// Close dropdown when clicking outside
	document.addEventListener('click', function(e) {
		if (!profileButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
			dropdownMenu.classList.remove('show');
		}
	});
}

/**
 * Start page functions.
 */
async function startPageFunctions() {
	// Check if user is guest and redirect if needed
	if (GROUP_ALIAS === config.guestAlias) {
		window.location.href = "index.html";
		return;
	}

	// After short delay, show loading state (skip loading state entirely if very quick loading)
	const loadingTimeout = setTimeout(() => {
		driveAppList.style.opacity = ""
	}, 1000)

	try {
		setCustomClientErrorHandler()

		// Get DriveApps
		const driveApps = await client.getDriveApps(GROUP_ALIAS)
		clearTimeout(loadingTimeout)

		// (Optional) Order alphabetically by alias
		const orderedDriveApps = sortDriveAppsByAlias(driveApps)

		// Render DriveApps
		renderDriveApps(orderedDriveApps)
	} catch (error) {
		handleGenericError(error)
	}
}

/**
 * Render DriveApps to container.
 *
 * @param {Object} driveApps - DriveAppData object.
 */
function renderDriveApps(driveApps) {
	// Clear loading state, show list
	driveAppList.innerHTML = ""
	driveAppList.style.opacity = ""

	// Empty state
	if (!driveApps || !driveApps.length) {
		driveAppList.innerHTML = `
            <div class="empty-drive-apps">
                <p>No DriveApps available.</p>
            </div>
        `
		return
	}

	// Loop out DriveApps
	for (let index = 0; index < driveApps.length; index++) {
		const driveApp = driveApps[index]
		let title, description, icon;

		// Customize display based on app
		if (driveApp.alias === "CPQ") {
			title = "Quotes & Orders"
			description = "View and manage quotes and orders"
			icon = "quotes.png"
		} else if (driveApp.alias === "CPQ Embedded") {
			title = "Create New Quote"
			description = "Create a new quote"
			icon = "new-quote.png"
		} else {
			title = driveApp.alias
			description = driveApp.name
			icon = "dist/icons.svg#drive-app-item"
		}

		const markup = `
            <div class="inner">
                <div class="app-icon">
                    ${icon.endsWith('.png') 
                        ? `<img src="dist/img/${icon}" alt="${title}" />` 
                        : `<svg class="icon"><use xlink:href="${icon}" /></svg>`
                    }
                </div>
                <div class="details">
                    <h4 class="drive-app-alias" title="${title}">${title}</h4>
                    <div class="drive-app-name" title="${description}">${description}</div>
                </div>
                <div class="drive-app-action">Start</div>
            </div>
        `

		// Create DriveApp item
		const item = document.createElement("a")
		item.classList.add("drive-app-item")
		item.style.setProperty("--index", index)
		item.setAttribute("data-id", driveApp.id)
		item.href = `run.html?driveApp=${driveApp.alias}`
		item.title = `Start DriveApp: ${title}`
		item.innerHTML = markup

		driveAppList.appendChild(item)

		// Animate entrance (hidden by default)
		item.classList.add("animate")
	}
}

/**
 * Order DriveApps alphabetically by alias.
 * @param {Object} driveApps - The unsorted DriveApps to order.
 */
function sortDriveAppsByAlias(driveApps) {
	return driveApps.sort((a, b) => {
		return a.alias.localeCompare(b.alias, undefined, {
			numeric: true,
			caseFirst: "upper",
		})
	})
}