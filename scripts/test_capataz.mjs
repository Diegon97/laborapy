async function run() {
    try {
        const response2 = await fetch("http://127.0.0.1:8317/v1/chat/completions", {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer cpa-local-2f1e299d67fe4fbbaa862ef78d418f08047245b8'
            },
            body: JSON.stringify({
                model: 'gemini-3.8-flash-high',
                messages: [{ role: 'user', content: 'hola, devolveme solo este JSON: [{"test":"ok"}]' }]
            })
        });
        const data2 = await response2.text();
        console.log("RESPONSE 8317:", data2);
    } catch(e) { console.log("ERR 8317:", e.message) }
}
run();