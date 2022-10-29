import {Body, Controller, Get, Post, Query} from '@nestjs/common';
import {ApiOperation, ApiTags} from "@nestjs/swagger";
import {WhatsappSessionManager} from "../core/manager";
import {
    ChatRequest,
    CheckNumberStatusQuery,
    MessageContactVcardRequest,
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
        const whatsapp = this.whatsappSessionManager.getSession(request.sessionName)
        return whatsapp.checkNumberStatus(request)
    }

    @Post('/sendContactVcard')
    sendContactVcard(@Body() message: MessageContactVcardRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(message.sessionName)
        return whatsapp.sendContactVCard(message)
    }

    @Get('/sendText')
    @ApiOperation({summary: 'Send a text message'})
    sendTextGet(
        @Query() message: MessageTextQuery,
    ) {
        const whatsapp = this.whatsappSessionManager.getSession(message.sessionName)
        const msg = new MessageTextRequest()
        msg.chatId = message.phone
        msg.text = message.text
        return whatsapp.sendText(new MessageTextRequest())
    }

    @Post('/sendText')
    @ApiOperation({summary: 'Send a text message'})
    sendText(@Body() message: MessageTextRequest): Promise<WAMessage> {
        const whatsapp = this.whatsappSessionManager.getSession(message.sessionName)
        return whatsapp.sendText(message)
    }

    @Post('/sendTextButtons')
    @ApiOperation({summary: 'Send a text message with buttons'})
    sendTextButtons(@Body() message: MessageTextButtonsRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(message.sessionName)
        return whatsapp.sendTextButtons(message)
    }

    @Post('/sendLocation')
    sendLocation(@Body() message: MessageLocationRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(message.sessionName)
        return whatsapp.sendLocation(message)
    }

    @Post('/sendLinkPreview')
    sendLinkPreview(@Body() message: MessageLinkPreviewRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(message.sessionName)
        return whatsapp.sendLinkPreview(message)
    }

    @Post('/sendImage')
    @ApiOperation({})
    sendImage(@Body() message: MessageImageRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(message.sessionName)
        return whatsapp.sendImage(message)
    }

    @Post('/sendFile')
    @ApiOperation({})
    sendFile(@Body() message: MessageFileRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(message.sessionName)
        return whatsapp.sendFile(message)
    }

    @Post('/reply')
    @ApiOperation({summary: 'Reply to a text message'})
    reply(@Body() message: MessageReplyRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(message.sessionName)
        return whatsapp.reply(message)
    }

    @Post('/sendSeen')
    sendSeen(@Body() chat: ChatRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(chat.sessionName)
        return whatsapp.sendSeen(chat)
    }

    @Post('/startTyping')
    async startTyping(@Body() chat: ChatRequest) {
        // It's infinitive action
        const whatsapp = this.whatsappSessionManager.getSession(chat.sessionName)
        await whatsapp.startTyping(chat)
        return {result: true}
    }

    @Post('/stopTyping')
    async stopTyping(@Body() chat: ChatRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(chat.sessionName)
        await whatsapp.stopTyping(chat)
        return {result: true}
    }
}
