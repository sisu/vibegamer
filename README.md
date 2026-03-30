Simple game-prototyping website: User writes a simple game description, and AI generates a game prototype that is immediately playable in the browser.

Requirements for the website:
- It should use AI model that is fast and relatively cheap. The site is not intended for making production quality games, but for simple demos.
- The game can be refined by further prompts. For security, the client shouldn't send the existing code, but the server should have it stored and the client only references the existing code by some key.
- There should be a share option that creates a link that can be shared.
- Sharing creates a snapshot of the current state; editing the game afterwards won't affect the shared link.
- When users open a link to a shared game, it won't immediately launch the game (for security reasons). Instead there is a button to play the game, and the user can also see the prompts used to generate it.
- Users can also make edits to games that they got from shared links. The original link is not affected, but they can create a new link to share their edits.
- The game generating behavior depends on whether the user is on mobile or desktop: If the user is on mobile, we should create a mobile game and similarly for desktop.
- Games assets: We should create a library of game assets such as icons and characters. The AI that generates the code should be aware of these assets and use them as needed.
- For safety reasons, only the predefined assets can be used. Referencing any assets outside the website should be disallowed by JS origin rules.
- Always use some simple game engine that allows us to create simple games with minimal code (also hosted on the same server).
- Consider how to mitigate any other safety issues, such as someone misusing server and causing high AI bills, users opening shared link to some malicious code or user hijacking the game generating prompt somehow.
