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
    sendContactVcard(@Body() request: MessageContactVcardRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(request.sessionName)
        return whatsapp.sendContactVCard(request)
    }

    @Get('/sendText')
    @ApiOperation({summary: 'Send a text message'})
    sendTextGet(
        @Query() query: MessageTextQuery,
    ) {
        const whatsapp = this.whatsappSessionManager.getSession(query.sessionName)
        const msg = new MessageTextRequest()
        msg.chatId = query.phone
        msg.text = query.text
        return whatsapp.sendText(new MessageTextRequest())
    }

    @Post('/sendText')
    @ApiOperation({summary: 'Send a text message'})
    sendText(@Body() request: MessageTextRequest): Promise<WAMessage> {
        const whatsapp = this.whatsappSessionManager.getSession(request.sessionName)
        return whatsapp.sendText(request)
    }

    @Post('/sendTextButtons')
    @ApiOperation({summary: 'Send a text message with buttons'})
    sendTextButtons(@Body() request: MessageTextButtonsRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(request.sessionName)
        return whatsapp.sendTextButtons(request)
    }

    @Post('/sendLocation')
    sendLocation(@Body() request: MessageLocationRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(request.sessionName)
        return whatsapp.sendLocation(request)
    }

    @Post('/sendLinkPreview')
    sendLinkPreview(@Body() request: MessageLinkPreviewRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(request.sessionName)
        return whatsapp.sendLinkPreview(request)
    }

    @Post('/sendImage')
    @ApiOperation({})
    sendImage(@Body() request: MessageImageRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(request.sessionName)
        return whatsapp.sendImage(request)
    }

    @Post('/sendFile')
    @ApiOperation({})
    sendFile(@Body() request: MessageFileRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(request.sessionName)
        return whatsapp.sendFile(request)
    }

    @Post('/reply')
    @ApiOperation({summary: 'Reply to a text message'})
    reply(@Body() request: MessageReplyRequest) {
        const whatsapp = this.whatsappSessionManager.getSession(request.sessionName)
        return whatsapp.reply(request)
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
