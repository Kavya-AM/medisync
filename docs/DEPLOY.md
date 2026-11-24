# Put MediSync online (free tiers)

You need a GitHub account. Push the `medisync` folder to a new repository first.

## 1. Database: MongoDB Atlas
1. Create a free cluster at mongodb.com/atlas.
2. Database Access: add a user and password. Network Access: allow `0.0.0.0/0` (anywhere).
3. Copy the connection string and put your password in it. This is your `MONGO_URI`.

## 2. API: Render
1. render.com > New > Blueprint > pick your repository. It reads `render.yaml`.
2. Fill in `MONGO_URI`. Leave the optional keys empty for now.
3. Set `CLIENT_URL` after step 3 (your Vercel address).
4. Open the Render **Shell** tab and run `npm run seed` once.
5. Check `https://YOUR-API.onrender.com/api/health` shows `{"ok":true}`.
The free plan sleeps when idle, so the first request after a break takes about 30 seconds. Open it once before you present.
Uploaded record files are kept on the server disk, which the free plan erases on restart. Use a paid disk, or swap the upload code for Cloudinary, before real use.

## 3. Web app: Vercel
1. vercel.com > Add New Project > pick the repository > Root Directory: `client`.
2. Environment variable: `VITE_API_URL` = your Render address (no slash at the end).
3. Deploy, then copy the Vercel address into `CLIENT_URL` on Render.

## 4. Mobile app
In `mobile/lib/main.dart` change `base` to `https://YOUR-API.onrender.com/api`, then `flutter build apk`.
