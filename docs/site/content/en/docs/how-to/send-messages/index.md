---
title : "Send messages"
description: "Send messages"
lead: ""
date: 2020-10-06T08:48:45+00:00
lastmod: 2020-10-06T08:48:45+00:00
draft: false
images: []
weight: 200
---

## Fields
There are common fields that you can find in almost all requests:
- `session` - a session name from which account you're sending the message. We use `default` in the examples.
  - Core ![](/images/versions/core.png) version supports only `default` session.
  - Plus ![](/images/versions/plus.png) allows you to run multiple sessions inside one container to save your memory and CPU resources!
Read more about [multiple sessions →]({{< relref "/docs/how-to/session" >}})

- `chatId` - it's a phone number or Group identifier where you're sending the message.
  - **Phone numbers** accounts use international phone number without + at the start and add `@c.us` at the end.
    For phone number `12132132131` the `chatId` is  `12132132131@c.us`.
  - **Groups** use random number with `@g.us` at the end.

## Send text ![](/images/versions/core.png) ![](/images/versions/plus.png)
To send text message - use `POST /api/sendText` with example payload.
```json
{
  "session": "default",
  "chatId": "12132132130@c.us",
  "text": "Hi there!"
}
```

## Reply on message ![](/images/versions/core.png) ![](/images/versions/plus.png)
To reply on a message - use `POST /api/reply` with example payload.
```json
{
  "session": "default",
  "chatId": "11111111111@c.us",
  "reply_to": "false_11111111111@c.us_AAAAAAAAAAAAAAAAAAAA",
  "text": "Reply text"
}
```
### Attach files ![](/images/versions/plus-soon.png)
WAHA does not support reply with files (images, voice, etc). If you're interested in it - please create an issue in GitHub.

## Send image ![](/images/versions/plus.png)
Use `POST /api/sendImage` to send images.
You can send images with two options
### Attach base64 data
You can encode the whole file content into base64 and send it in the request body
```json
{
  "session": "default",
  "chatId": "11111111111@c.us",
  "file": {
    "mimetype": "image/jpeg",
    "filename": "filename.jpeg",
    "data": "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"
  },
  "caption": "string"
}
```

### Provide an URL

## Send voice ![](/images/versions/plus.png)
## Send file ![](/images/versions/plus.png)

