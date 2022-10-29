import {Body, Controller, Get, NotImplementedException, Post, Query} from '@nestjs/common';
import {ApiOperation, ApiTags} from "@nestjs/swagger";
import {ensureSuffix} from "../utils";
import {WhatsappSessionManager} from "../core/manager";
import {
    ChatRequest,
    CheckNumberStatusQuery,
    MessageContactVcard,
    MessageFileRequest,
    MessageImageRequest,
    MessageLinkPreviewRequest,
    MessageLocationRequest,
    MessageReplyRequest,
    MessageTextButtonsRequest,
    MessageTextQuery,
    MessageTextRequest
} from "../structures/requests.dto";
import {WAMessage} from "../structures/WA.dto";

@Controller('api')
@ApiTags('chatting')
export class ChattingController {
    constructor(private whatsappSessionManager: WhatsappSessionManager) {
    }

    @Get('/checkNumberStatus')
    @ApiOperation({summary: 'Check number status'})
    async checkNumberStatus(
        @Query() request: CheckNumberStatusQuery,
    ) {
        const whatsapp = this.whatsappSessionManager.getInstance(request.sessionName)
        try {
            const result = await whatsapp.checkNumberStatus(ensureSuffix(request.phone))
            return {numberExists: result['numberExists']}
        } catch (error) {
            // We need to "touch" the error in order to get unhandled rejections
            // It logs out the session and stop the app
            console.log(typeof error)
            console.log(error)
            return {numberExists: false}
        }
    }

    @Post('/sendContactVcard')
    sendContactVcard(@Body() message: MessageContactVcard) {
        const whatsapp = this.whatsappSessionManager.getInstance(message.sessionName)
        return whatsapp.sendContactVcard(message.chatId, message.contactsId, message.name)
    }

    @Get('/sendText')
    @ApiOperation({summary: 'Send a text message'})
    sendTextGet(
        @Query() message: MessageTextQuery,
    ) {
        const whatsapp = this.whatsappSessionManager.getInstance(message.sessionName)
        return whatsapp.sendMessage(ensureSuffix(message.phone), message.text)
    }

    @Post('/sendText')
    @ApiOperation({summary: 'Send a text message'})
    sendText(@Body() message: MessageTextRequest): WAMessage {
        const whatsapp = this.whatsappSessionManager.getInstance(message.sessionName)
        return whatsapp.sendMessage(ensureSuffix(message.chatId), message.text)
    }

    @Post('/sendTextButtons')
    @ApiOperation({summary: 'Send a text message with buttons'})
    sendTextButtons(@Body() message: MessageTextButtonsRequest) {
        const whatsapp = this.whatsappSessionManager.getInstance(message.sessionName)
        return whatsapp.sendButtons(ensureSuffix(message.chatId), message.title, message.buttons, message.text)
    }

    @Post('/sendLocation')
    sendLocation(@Body() message: MessageLocationRequest) {
        const whatsapp = this.whatsappSessionManager.getInstance(message.sessionName)
        return whatsapp.sendLocation(message.chatId, message.latitude, message.longitude, message.title)
    }

    @Post('/sendLinkPreview')
    sendLinkPreview(@Body() message: MessageLinkPreviewRequest) {
        const whatsapp = this.whatsappSessionManager.getInstance(message.sessionName)
        return whatsapp.sendLinkPreview(message.chatId, message.url, message.title)
    }

    @Post('/sendImage')
    @ApiOperation({summary: 'NOT IMPLEMENTED YET'})
    sendImage(@Body() message: MessageImageRequest) {
        throw new NotImplementedException();
        // TODO: Accept image URL, download it and then send with path
        const whatsapp = this.whatsappSessionManager.getInstance(message.sessionName)
        return whatsapp.sendImage(message.chatId, message.path, message.filename, message.caption)
    }

    @Post('/sendFile')
    @ApiOperation({summary: 'NOT IMPLEMENTED YET'})
    sendFile(@Body() message: MessageFileRequest) {
        throw new NotImplementedException();
        // TODO: Accept File URL, download it and then send with path
        const whatsapp = this.whatsappSessionManager.getInstance(message.sessionName)
        return whatsapp.sendFile(message.chatId, message.path, message.filename, message.caption)
    }

    @Post('/reply')
    @ApiOperation({summary: 'Reply to a text message'})
    reply(@Body() message: MessageReplyRequest) {
        const whatsapp = this.whatsappSessionManager.getInstance(message.sessionName)
        return whatsapp.reply(message.chatId, message.text, message.reply_to)
    }

    @Post('/sendSeen')
    sendSeen(@Body() chat: ChatRequest) {
        const whatsapp = this.whatsappSessionManager.getInstance(chat.sessionName)
        return whatsapp.sendSeen(chat.chatId)
    }

    @Post('/startTyping')
    startTyping(@Body() chat: ChatRequest) {
        // It's infinitive action
        const whatsapp = this.whatsappSessionManager.getInstance(chat.sessionName)
        whatsapp.startTyping(chat.chatId)
        return true
    }

    @Post('/stopTyping')
    stopTyping(@Body() chat: ChatRequest) {
        const whatsapp = this.whatsappSessionManager.getInstance(chat.sessionName)
        whatsapp.stopTyping(chat.chatId)
        return true
    }
}
