// will update if deta supports ESM
import path from "path"
const __dirname = path.resolve()
import express from "express"
const server = express()
import fetch from "node-fetch"
import dotenv from "dotenv"
import ejs from "ejs"
dotenv.config()
import { AuthorizationCode } from "simple-oauth2"
const config = {
    client: {
        id: process.env.CLIENT_ID
    },
    auth: {
        tokenHost: "https://discord.com",
        authorizePath: "/oauth2/authorize",
    }
}
const client = new AuthorizationCode(config)
server.engine("html", ejs.renderFile)
server.use(express.json())

server.get("/", (req, res) => {
    const url = client.authorizeURL({
        redirect_uri: process.env.REDIRECT_URL,
        scope: "identify guilds.join"
    })
    return res.redirect(url)
})

server.get("/callback", async (req, res) => {
    const data = new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code: req.query.code,
        redirect_uri: process.env.REDIRECT_URL,
        grant_type: "authorization_code",
        scope: "identify guilds.join"
    })

    const getToken = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        body: data,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    })
    if (getToken.status !== 200) {
        return res.send("error: failed to get token")
    }
    const access_json = await getToken.json()
    const getUserID = await fetch("https://discord.com/api/users/@me", {
        headers: {
            "Authorization": `Bearer ${access_json.access_token}`
        }
    })
    if (getUserID.status !== 200) return res.send("error: failed to get user")
    const userID_json = await getUserID.json()
    const addMember = await fetch(`https://discord.com/api/guilds/${process.env.SERVER_ID}/members/${userID_json.id}`, {
        method: "PUT",
        headers: {
            "Authorization": `Bot ${process.env.BOT_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            access_token: access_json.access_token
        }),
    })
    // revoke for safety
    await fetch("https://discord.com/api/oauth2/token/revoke", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            token: access_json.access_token
        })
    })
    console.log(addMember.status)
    if (await addMember.status === 201 || await addMember.status === 204) return res.render(`${__dirname}/web/success.html`,{
        server_id: process.env.SERVER_ID
    })
    else return res.send("error: failed to invite server")
})

if (!process.env.DETA_RUNTIME) {
    server.listen(8080, () => {
        console.log("Example app listening at http://localhost:8080")
    })
}

export default server
