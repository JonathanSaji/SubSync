ProjectBeta Backend

This branch adds the backend for ProjectBeta. The server.js file runs the Node.js server that handles requests and serves data. All actual data is stored in the data/ folder, like subscriptions.json, so nothing is hardcoded.

The .gitignore file makes sure the node_modules/ folder isn’t uploaded to Git, since it can be recreated with npm install. Basically, anyone who clones the repo just needs to run npm install to get all the dependencies, then start the server with node server.js.
