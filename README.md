# isokoLink

isokoLink is an agricultural marketplace built for East Africa. The idea came from 
a simple observation — farmers and buyers have no easy way to find each other. 
Markets are physical, distances are long, and a lot of produce goes to waste simply 
because the right buyer never showed up. This app tries to fix that.

Farmers can sign up, list what they have for sale, and put themselves on the map — 
literally. Buyers can browse listings, filter by what they need, see exactly where 
the farmer is located, and send them a message directly. The messaging is real time, 
so it feels like a conversation rather than sending a form into the void.

---

## Try it out

The app is live at **https://www.panom-kaidit.tech**

There is also a short demo video here:

---

## What it does

When you first land on the app you can choose to sign up as a farmer or a buyer. 
The two roles have different dashboards.

As a **farmer** you can add produce listings with a name, price, quantity, and your 
location. The app uses Nominatim (OpenStreetMap's geocoding service) to automatically 
convert your district or region name into GPS coordinates so your listing shows up on 
the map. You can also view and manage your existing listings and respond to messages 
from buyers.

As a **buyer** you get access to the marketplace where you can search for specific 
produce, filter by category or location, and sort by price. Every listing has a 
"Message Farmer" button that takes you straight into a real-time chat. There is also 
a map view that shows all available listings as pins so you can see what is near you.

---

## APIs used

**Nominatim (OpenStreetMap)**  
This handles all the geocoding. When a farmer types in their district name, Nominatim 
converts it to latitude and longitude coordinates. I built an in-memory cache around 
it to avoid hitting the rate limit (they allow 1 request per second).  
Docs: https://nominatim.org/release-docs/latest/

**Leaflet.js**  
This is what powers the map. It is an open source JavaScript library that renders 
interactive maps in the browser using OpenStreetMap tiles.  
Docs: https://leafletjs.com/reference.html

**Socket.io**  
This handles the real-time messaging. When a buyer sends a message, the farmer sees 
it instantly without needing to refresh the page.  
Docs: https://socket.io/docs/v4/

---

## Running it locally

You will need Node.js (v18 or newer) and a MongoDB Atlas connection string.
```bash
git clone https://github.com/YOUR_USERNAME/isokoLink.git
cd isokoLink/Backend
npm install
```

Create a `.env` file in the Backend folder:
```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=pick_any_long_random_string
NODE_ENV=development
```

Then start the server:
```bash
node server.js
```

Open your browser and go to `http://localhost:5000`. That is it.

If you prefer Docker:
```bash
cd isokoLink
docker compose up -d --build
```

---

## How I deployed it

The setup has three servers — two web servers (Web01 and Web02) running the actual 
app, and a load balancer (Lb01) sitting in front of them.

### On each web server

I cloned the repo, created the `.env` file with production values, and started the 
app using Docker Compose. The containers run with `network_mode: host` because the 
servers use OpenVZ virtualization which does not support Docker bridge networking.

In front of the Node.js app I set up Nginx as a reverse proxy. The important part 
here is getting the WebSocket headers right — without `Connection "upgrade"` (with 
double quotes, not single quotes) Socket.io will throw 400 errors constantly.
```nginx
server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

### On the load balancer

Lb01 was already running HAProxy when I got to it. I configured it to distribute 
traffic between the two web servers using round-robin, and added SSL termination 
using a Let's Encrypt certificate for `www.panom-kaidit.tech`.

The most important thing I learned here is that HAProxy needs `timeout tunnel` set 
to a high value, otherwise it will cut off long-lived WebSocket connections. I also 
had to make sure the redirect to HTTPS only happens in the HTTP frontend — if you 
put it in the HTTPS frontend too, you get an infinite redirect loop.
```
frontend http_front
    bind *:80
    redirect scheme https code 301

frontend https_front
    bind *:443 ssl crt /etc/ssl/private/haproxy.pem
    default_backend web_servers

backend web_servers
    balance roundrobin
    option forwardfor
    option http-server-close
    server web01 3.83.153.109:80 check
    server web02 13.218.53.237:80 check
```

Traffic flows like this:
```
User → HAProxy (HTTPS, port 443) → Web01 or Web02 (HTTP, port 80) → Node.js (port 5000)
```

---

## Challenges I ran into

The biggest headache was Socket.io. I spent a long time looking at 400 errors in 
the browser before I figured out it was the single quotes around `'upgrade'` in 
Nginx. HAProxy also needs `timeout tunnel` or it silently drops WebSocket connections 
after 50 seconds.

Docker was another challenge. The servers use OpenVZ virtualization which strips out 
a lot of the Linux kernel features that Docker normally relies on for networking. 
Bridge networking simply does not work on these servers, so I had to switch to 
`network_mode: host` in docker-compose.yml.

Getting the Nominatim geocoding to work reliably required adding a caching layer. 
Without it the app would hit the rate limit quickly when multiple users loaded the 
marketplace at the same time.

---

## Security notes

- Passwords are hashed with bcrypt before being stored
- All protected routes require a valid JWT token
- The `.env` file is in `.gitignore` and never committed to the repo
- Helmet.js is used to set secure HTTP headers
- CORS is configured to only accept requests from trusted origins in production

---

## Credits

- OpenStreetMap and Nominatim for geocoding and map tiles — https://www.openstreetmap.org/copyright
- Leaflet.js by Vladimir Agafonkin — https://leafletjs.com
- Socket.io — https://socket.io
- Font Awesome for icons — https://fontawesome.com
- Express, Mongoose, bcryptjs, jsonwebtoken, Helmet — all open source npm packages

BY: Panom Michael Makuei
