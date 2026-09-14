# Bazara — App Review submission pack

App ID: `1063634949367370` · Business: `695515553352363`
Login for Business config: `967328979728469`

---

## Part 1 — "Describe how your app uses this permission"

Copy each block into the matching permission's **Describe how your app uses this
permission or feature** field.

---

### pages_show_list

```
Bazara is a multi-store fashion marketplace. Each store owner can optionally
connect their own Instagram Business account so that Direct Messages from their
customers appear in the Bazara dashboard, where the owner can reply or turn a
conversation into an order.

To connect, the store owner signs in with Facebook Login for Business. We then
call GET /me/accounts to list the Facebook Pages that person manages, together
with the Instagram Business account linked to each Page. The store owner is
shown this list in our dashboard and picks which Page to connect.

Without pages_show_list we cannot show the owner which Pages they manage, so
they have no way to choose the account to connect and the feature cannot start.
We only read the Page name and ID for this selection screen, and only for the
person who is signing in.
```

---

### pages_manage_metadata

```
After the store owner picks a Page, Bazara subscribes that Page to our webhook
so incoming messages reach the owner's dashboard. We call
POST /{page-id}/subscribed_apps with subscribed_fields=messages,messaging_postbacks.

When the owner disconnects their account from the Bazara dashboard, we call
DELETE /{page-id}/subscribed_apps to remove the subscription and we delete the
stored access tokens.

Without pages_manage_metadata we cannot subscribe to the Page's messaging
webhook, so no message would ever be delivered and the inbox would stay empty.
We use this permission only to manage the webhook subscription of Pages the
owner explicitly connected.
```

---

### pages_messaging

```
Bazara shows a store owner the Direct Messages sent to their connected account
and lets them answer from their dashboard. Replies are sent through the Page
using POST /me/messages with the Page access token.

The owner can send a text reply, reply to one specific message, react to a
message, and send an image (our dashboard uploads the image to our media host
first and passes the resulting public URL, because the API fetches attachments
by URL).

Without pages_messaging we could display incoming conversations but the owner
could not answer them, which removes the entire point of the feature: answering
a customer and converting that chat into an order without leaving Bazara.
```

---

### pages_read_engagement

```
This permission is required alongside pages_manage_metadata and pages_show_list
for the messaging integration described above. Bazara reads the connected Page's
basic content and engagement data so that the messaging inbox can show a
conversation in its correct context — for example when a customer replies to a
story or to a post, so the store owner sees what the customer is referring to
instead of an isolated message.

We do not publish anything to the Page and we do not read engagement for Pages
the store owner has not connected.
```

---

### instagram_basic

```
When a store owner connects their account, we read the Instagram Business
account linked to the chosen Facebook Page (its ID and username) through the
instagram_business_account field on GET /me/accounts.

The username is shown in the Bazara dashboard so the owner can confirm which
account is connected (our dashboard displays, for example, "@haboosh._style"
with an option to disconnect). We also read the basic profile of a person who
messages the store (name, username, profile picture) so the inbox shows a real
person instead of a numeric ID.

Without instagram_basic we cannot identify which Instagram account belongs to
the Page, so we cannot connect the account at all. instagram_manage_messages
also depends on it.
```

---

### instagram_manage_messages

```
This is the core of the feature. Bazara receives Instagram Direct Messages sent
to a connected store's account through a webhook, stores them, and displays them
in that store owner's dashboard inbox. The owner can then reply with text,
reply to one specific message, react to a message, send a voice message or an
image, and convert the conversation into an order in the store.

Messages are sent with POST /me/messages using the Page access token of the
account the owner connected. Every store owner sees only the messages of their
own connected account.

Small fashion businesses in our market take most of their orders through
Instagram DMs. Without instagram_manage_messages the owner has to switch between
Instagram and Bazara and retype every order by hand, which is exactly the problem
this product solves.
```

---

### business_management

```
Bazara uses Facebook Login for Business, and the Pages and Instagram accounts our
store owners connect are owned by their business portfolios rather than by a
personal profile. business_management lets the login flow read which business
assets the person signing in is allowed to manage, so we can present the correct
Pages for them to connect.

We use it only during the connection step, to resolve the assets the store owner
already controls. We do not create, modify or delete business assets, and we do
not access businesses the person signing in does not manage.
```

---

### public_profile

```
public_profile gives us the basic identity (name and ID) of the person signing in
with Facebook Login for Business. Bazara uses it to link the connection to the
correct store account in our system and to show the store owner which Facebook
identity the connection was made with, so they can confirm they connected the
right account before we store any tokens.

This is the baseline identity needed for the login itself; no other use.
```

---

## Part 2 — The screencast

One video covers all eight permissions. Record it once and upload the same file
to every permission that asks for a screencast.

Record on a phone or with screen capture, 2–3 minutes, no cuts. Show the whole
journey without skipping a step — a missing step is the most common rejection.

**Scenario to follow, in order:**

1. Open `https://bazarastore.site` and log in as a store owner.
2. Go to the dashboard, open the Instagram tab.
3. Show the disconnected state, then press **Connect Instagram**.
4. Show the Facebook Login for Business dialog appearing.
5. Show the permissions screen and the list of Pages, and pick a Page.
6. Show the return to the Bazara dashboard with the account now connected
   (the `@username` visible on screen).
7. From a **second phone**, send a Direct Message to that Instagram account.
8. Show the message arriving in the Bazara inbox.
9. Open the conversation, type a reply and send it.
10. Show the reply arriving on the second phone inside Instagram.
11. Show converting the conversation into an order (the "Create order" button).
12. Finally, show the **Disconnect account** button and press it, showing the
    account is disconnected.

Step 12 matters: reviewers want to see that the user can revoke the connection.

---

## Part 3 — Reviewer instructions

The Reviewer instructions section needs written steps plus a test account.

**Test account:** create a real store account on `bazarastore.site` for the
reviewer with an active subscription, and give its email and password in that
section. The reviewer must be able to reach the dashboard without contacting you.

**Steps text:**

```
Test credentials:
  URL: https://bazarastore.site
  Email: <reviewer account email>
  Password: <reviewer account password>

1. Open https://bazarastore.site and sign in with the credentials above.
2. You will land on the store owner dashboard.
3. Open the "Instagram" tab in the dashboard.
4. Press "Connect Instagram". Facebook Login for Business opens.
5. Sign in and grant the requested permissions, then choose a Facebook Page that
   has an Instagram Business account linked to it.
6. You are returned to the dashboard. The connected Instagram username is now
   shown, with "Update" and "Disconnect" actions next to it.
7. From any Instagram account, send a Direct Message to the connected business
   account.
8. The message appears in the "Instagram messages" inbox on the dashboard.
9. Open the conversation and send a reply. The reply is delivered to the sender
   in Instagram.
10. Use "Create order" on a conversation to turn the chat into an order.
11. Press "Disconnect" to revoke the connection. The webhook subscription is
    removed and the stored access tokens are deleted.

Notes:
- Every store owner only ever sees the messages of the account they connected.
- Access tokens are stored encrypted and are deleted on disconnect.
- Privacy policy: https://bazarastore.site/privacy
- Terms of service: https://bazarastore.site/terms
```

---

## Part 4 — Data handling section

Expect questions about where data goes. The truthful answers for Bazara:

- Message content and sender profile data are stored in our own PostgreSQL
  database, used only to display the conversation to the store owner who owns
  that account.
- Access tokens are stored **encrypted**.
- Data is **not sold**, and **not shared with third parties for advertising**.
- A store owner can disconnect at any time from the dashboard; the webhook
  subscription is removed and the stored tokens are deleted.
- Full deletion can be requested by email; the data deletion URL is registered
  in the app settings.
