async function testApi() {
	console.log("Testing API route /api/render-motion");
	try {
        const response = await fetch("http://localhost:3000/api/render-motion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                compositionId: "lower-third",
                props: { primaryText: "Hello World" },
                width: 1920,
                height: 1080,
                fps: 30,
                durationInFrames: 150,
            }),
        });

        console.log("Status:", response.status, response.statusText);
        if (!response.ok) {
            const body = await response.text();
            console.error("Error body:", body);
        } else {
            console.log("Success! Content-Type:", response.headers.get("content-type"));
            console.log("Content-Length:", response.headers.get("content-length"));
        }
    } catch (err) {
        console.error("Failed to fetch:", err);
    }
}

testApi();
