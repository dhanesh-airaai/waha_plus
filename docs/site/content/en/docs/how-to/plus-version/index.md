---
title : "Plus version"
description: "Plus version"
lead: ""
date: 2020-10-06T08:48:45+00:00
lastmod: 2020-10-06T08:48:45+00:00
draft: false
images: []
weight: 900
---

**WAHA** is distributed in two versions:

1. Core ![](/images/versions/core.png) the basic version that meet almost 80% people’s needs. 100% free and open source.
2. Plus ![](/images/versions/plus.png) the version with advanced messages, security, and reliability features.

Plus version - available through **donations** - either one time or subscription.

**It doesn't require monthly subscriptions, once installed on your server - it always works!**

{{< alert icon="💡" text="No licence checks or expiration on already installed instances!" />}}

## Donations
We do not sell **WAHA**, it's not a purchase. It's a donation.

We treat our projects like an art. You donate to the project and get a bit more from it as a thank-you. 😊

{{< alert icon="💡" text="WAHA does not have license checks and expiration - because **art can not expire**! Enjoy it till it works!" />}}

We re-donate most of the donations down to the stream to the underlying libraries and tools - JS-community, Node, other libraries authors, personal contributors.
By donating to the **WAHA** you donate to the Open Source world!

## Features

The Plus additional features are:

1. [**Send images\files\voices** →]({{< relref "/docs/how-to/send-messages" >}})
2. [**Receive images\files\voices** →]({{< relref "/docs/how-to/receive-messages" >}})
3. [**Webhook retries** →]({{< relref "/docs/how-to/receive-messages#retries" >}})
4. [**Security** →]({{< relref "/docs/how-to/security" >}})
5. [**Saving sessions** →]({{< relref "/docs/how-to/sessions" >}})
6. [**Support multiple sessions** →]({{< relref "/docs/how-to/sessions" >}})
7. **Instant updates** - no one month delay in getting bugfixes or new features
8. **Priority in support** - on both bugs and features

## Differences

What is the difference between **WAHA Plus** and other SaaS solutions for WhatsApp HTTP API?

|                    |                     WAHA Plus                     |                                                                            Others |
|--------------------|:-------------------------------------------------:|----------------------------------------------------------------------------------:|
| **Sessions**       |                   ✔️ No limits!                   |                                                      ➖ One account for $50/month. |
| **Infrastructure** | ✔️ On-Premise - your server, your infrastructure! |                                                        ➖ Insecure cloud solution. |
| **Security**       |                 ✔️ No data leaks!                 | ➖ You have to give access to customers' data - phone number, name, your messages. |
| **Message price**  |             ✔️ All messages are Free!             |                     ➖ Some solutions have a price for messages - $1/100 messages. |
| **Expenses**       |           ✔️ one-time $69 **donation**!           |                                                 ➖ Monthly payment starts from $50 |

## Get Plus ![](/images/versions/plus.png)

For $69 one-time donation you get:
1. **Secret password** for Docker Hub to download Plus image: `devlikeapro/whatsapp-http-api-plus`.
2. **All updates for one month** for the Plus image.
3. **NO LICENSE CHECKS** on installed instances!
4. **NO LICENSE EXPIRATION** on installed instances! We repeated it twice to make sure that you've got it 😊

{{< alert icon="👉" text="We don't mind if you stay subscribed with us after one month :)" />}}

### Boosty
We use Boosty to get donations (Patreon analogue) - [https://boosty.to/wa-http-api](https://boosty.to/wa-http-api).

Go ahead and get your monthly password to get no license expiration WhatsApp HTTP API - either subscribe or use one time donation!

{{< alert icon="💡" text="If you stay subscribed - the donation amount will never change for you and always be $69 to get monthly updates!" />}}

![](boosty.png)

### Patreon
You can support the project and get WAHA Plus version on Patreon: [https://patreon.com/wa_http_api](https://patreon.com/wa_http_api)

{{< alert icon="💡" text="Please look at Boosty - we prefer it because of lower fees, so we can donate more to the projects!" />}}


### Install Plus
After you get the password, use it to login and download docker image:
```bash
docker login -u devlikeapro -p {PASSWORD}
docker pull devlikeapro/whatsapp-http-api-plus
docker logout
```
Then in all commands use **Plus** image `devlikeapro/whatsapp-http-api-plus` instead of Core `devlikeapro/whatsapp-http-api`.
