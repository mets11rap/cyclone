const BaseHandler = require('../base-handler/')

const {
  InputError
} = require('../../errors/')

const {
  Command,
  Await,
  Replacer
} = require('../../structures/')

/**
 * The module that handles incoming commands
 */
class CommandHandler extends BaseHandler {
  /**
   * Create a CommandHandler
   * @class
   * @param {Object}              data                                    The command handler data
   * @prop  {Agent}               [data.agent]                            The agent managing the bot
   * @prop  {Eris.Client}         data.client                             The Eris client
   * @prop  {Command[]|Command}   [data.commands=[]]                      Array of commands to load initially
   * @prop  {Replacer[]|Replacer} [data.replacers=[]]                     Array of the message content replacers to load initially
   * @prop  {Object}              [data.options={}]                       Additional options for the command handler
   * @prop  {String}              [data.options.prefix='!']               The prefix of commands
   * @prop  {Object}              [data.options.replacerBraces={}]        The braces that invoke a replacer
   * @prop  {String}              [data.options.replacerBraces.open='|']  The opening brace
   * @prop  {String}              [data.options.replacerBraces.close='|'] The closing brace
   * @prop  {PrefixList}          [data.options.guildPrefixes]            Server-specific prefixes
   * @prop  {Object}              [data.options._app]                     The Discord bot app info (If not supplied, the app is gotten automatically)
   */
  constructor ({ agent, client, commands, replacers, options = {} }) {
    super({ agent, client, options })

    /**
     * Various regular expressions used internally
     * @private
     * @type    {Object}
     * @prop    {RegExp} escapables       Characters that must be escaped in Regex
     * @prop    {Object} dynamics         Regular expressions used for dynamic arguments
     * @prop    {RegExp} dynamics.user    Parse the ID out of a user mention
     * @prop    {RegExp} dynamics.channel Parse the ID out of a channel mention
     */
    this._regexes = {
      escapables: /[.*+?^${}()|[\]\\]/g,
      dynamics: {
        user: /<@!?(\d+)>/,
        channel: /<#(\d+)>/
      }
    }

    const {
      prefix = '!',
      replacerBraces: {
        open = '|',
        close = '|'
      } = {},
      guildPrefixes = {}
    } = options

    if (replacers && open.startsWith(prefix)) console.log('WARNING: Your replacer opening brace starts with your prefix. This could lead to some issues.')

    /**
     * Map of the commands
     * @private
     * @type    {Map<String, Command>}
     */
    this._commands = new Map()

    /**
     * Map of the command aliases
     * @private
     * @type    {Map<String, String>}
     */
    this._aliases = new Map()

    /**
     * Map of the message content replacers
     * @private
     * @type    {Map<String, Replacer>}
     */
    this._replacers = new Map()

    /**
     * An object containing message data used to wait for a user's response
     * @private
     * @type    {Map<String, AwaitData>}
     */
    this._awaits = new Map()

    /**
     * This options for the command handler
     * @private
     * @type    {Object}
     * @prop    {String}     prefix               The prefix to execute commands
     * @prop    {Object}     replacerBraces       The braces that invoke a replacer
     * @prop    {String}     replacerBraces.open  The opening brace
     * @prop    {String}     replacerBraces.close The closing brace
     * @prop    {PrefixList} guildPrefixes        Server-specific prefixes
     */
    this._options = {
      prefix,
      replacerBraces: {
        open,
        close
      },
      guildPrefixes
    }

    this.loadCommands(commands)
    this.loadReplacers(replacers)
  }

  /**
   * Set an await
   * @param   {Await[]|Await} awaits                     The command or a list of commands to await
   * @param   {Object}       [options={}]               The data for the awaits
   * @prop    {String}       [options._fallBackChannel] The channel ID to listen for the message on if its not defined in the Await object
   * @prop    {String}       [options._fallBackUser]    The user ID to listen for if its not defined in the Await object
   * @prop    {Eris.Message} [options._triggerResponse] The response to the command that created the awaits
   * @returns {Await[]}                                     The submitted awaits
   */
  addAwaits (awaits, { _fallBackChannel, _fallBackUser, _triggerResponse } = {}) {
    if (!Array.isArray(awaits)) awaits = [awaits]

    for (const wait of awaits) {
      if (!(wait instanceof Await)) throw TypeError('Supplied await is not an Await instance:\n' + wait)

      if (!wait.options.channel) {
        if (!_fallBackChannel) throw Error('An await didn\'t have a defined channel or fallback channel. This can be caused by directly calling CommandHandler.addAwaits')

        wait.options.channel = _fallBackChannel
      }
      if (!wait.options.user) {
        if (!_fallBackChannel) throw Error('An await didn\'t have a defined user or fallback user. This can be caused by directly calling CommandHandler.addAwaits')

        wait.options.user = _fallBackUser
      }

      const id = wait.options.channel + wait.options.user

      this._awaits.set(id, wait)

      wait.startTimer({ id, awaitMap: this._awaits, triggerResponse: _triggerResponse })
    }

    return awaits
  }

  /**
   * Tidy up after a command has finished executing
   * @private
   * @param   {Command} command The command object
   */
  _commandCleanup (command) {
    if (command instanceof Await) {
      if (command.options.refreshOnUse) command.refresh()
      else command.clear()
    }
  }

  /**
   * Get an awaited message
   * @private
   * @param   {Eris.Message}    msg        The message
   * @param   {Normalized}      normalized The normalized message content
   * @returns {Await|undefined}            The await
   */
  _getAwait (msg, normalized) {
    const wait = this._awaits.get(msg.channel.id + msg.author.id)

    if (wait) {
      if (wait.options.requirePrefix && !normalized.prefixed) return

      if (!wait.options.check(msg, normalized.content)) {
        if (wait.options.oneTime) wait.clear()

        return
      }

      return wait
    }
  }

  /**
   * Get a command
   * @param   {String}            name The name or an alias of the command
   * @returns {Command|undefined}      The found command
   */
  getCommand (name) {
    return this._commands.get(name) || this._commands.get(this._aliases.get(name))
  }

  /**
   * Get a replacer
   * @param   {String}            name The name of the replacer
   * @returns {Command|undefined}      The found replacer
   */
  getReplacer (name) {
    return this._replacers.get(name)
  }

  /**
   * Handle an incoming Discord messages
   * @async
   * @param   {Eris.Message}                      msg The Discord message
   * @returns {Promise<CommandHandlerResultList>}     The results of the command
   */
  async handle (msg) {
    // Normalize message content (replacers, prefix, custom prefix, bot mention)
    const normalized = this._normalize(msg)

    // Get Await class if awaited
    const awaited = await this._getAwait(msg, normalized)

    // No prefix
    if (!awaited && !normalized.prefixed) return

    // Get command
    const keyword = normalized.content.substring(0, normalized.content.includes(' ') ? normalized.content.indexOf(' ') : normalized.content.length).toLowerCase()
    const command = awaited || this.getCommand(keyword)

    if (!command) return

    // Basic command options checking
    if (command.options.restricted && this._app && msg.author.id !== this._app.owner.id) throw new InputError('This command is either temporarily disabled, or restricted', 'Check the bot\'s announcement feed', 'restricted')
    if (command.options.guildOnly && msg.channel.type) throw new InputError('This command has been disabled outside of guild text channels', 'Trying using it in a guild channel', 'nonguild')
    if (typeof command.action !== 'function') throw TypeError('Command action is not a function:\n' + (awaited ? 'awaitID: ' + awaited._id : command.name))

    // Run agent middleware (permissions)
    if (this._agent && this._agent._middleware) {
      for (const subroutine of this._agent._middleware) await subroutine(msg, msg.member, command)
    }

    // Process arguments
    let args = []

    if (command.options.args.length) {
      args = this._parseArgs(msg.channel.guild, command, normalized.content.substring(awaited && !awaited.options.shouldShift ? 0 : keyword.length + 1))

      if (!args || args.length < command.options.args.filter((a) => a.mand).length) throw new InputError('Invalid arguments', 'Reference the help menu.', 'arguments')
    }

    // Run command
    let commandResults = await command.action({
      agent: this._agent,
      msg,
      args,
      triggerResponse: command.triggerResponse
    })

    if (!Array.isArray(commandResults)) commandResults = [commandResults]

    // Process results and send responses
    const resultPromises = commandResults.map(async (commandResult) => {
      if (!commandResult) return

      const {
        content,
        embed,
        file,
        options = {}
      } = typeof commandResult === 'string' ? { content: commandResult } : commandResult

      let {
        channels = [msg.channel.id],
        awaits
      } = options

      if (!Array.isArray(channels)) channels = [channels]
      if (awaits && !Array.isArray(awaits)) awaits = [awaits]

      const responsePromises = channels.map((channel) => {
        const channelObject = this._client.getChannel(channel)

        return this._sendResponse(channelObject, { content, embed, file }).then((response) => this._implementResponse({ msg }, {
          ...options,
          channel,
          awaits
        }, response))
      })

      return Promise.all(responsePromises).then((responses) => {
        this._commandCleanup(command)

        return {
          options: {
            ...options,
            channels,
            awaits
          },
          responses
        }
      })
    })

    return Promise.all(resultPromises).then((results) => {
      return {
        command,
        results
      }
    })
  }

  /**
   * Load a command
   * @private
   * @param   {Command} command The command to load
   */
  _loadCommand (command) {
    if (!(command instanceof Command)) throw TypeError('Supplied command not a Command instance:\n' + command)

    if (command.options.args.length) {
      const lastArg = command.options.args[command.options.args.length - 1]
      const mandDiag = command.options.args.reduce((status, arg) => {
        if (!arg.mand) status.hasOpt = true
        else if (status.hasOpt) status.invalid = true

        return status
      }, {})

      if (lastArg.delim !== ' ') console.log(`DISCLAIMER: Command ${command.name}'s last argument unnecessarily has a delimiter.`)
      if (mandDiag.invalid) console.error(`WARNING: Command ${command.name} has invalid argument mandates.\nMake sure all arguments leading up to the last mandatory argument are mandatory as well.`)
    }

    this._commands.set(command.name, command)

    for (const alias of command.options.aliases) this._aliases.set(alias, command.name)
  }

  /**
   * Load commands
   * @param {Command[]|Command} [commands=[]] The command(s) to load
   */
  loadCommands (commands = []) {
    if (Array.isArray(commands)) {
      for (const command of commands) this._loadCommand(command)
    } else this._loadCommand(commands)
  }

  /**
   * Load a replacer
   * @private
   * @param   {Replacer} replacer The replacer to load
   */
  _loadReplacer (replacer) {
    if (!(replacer instanceof Replacer)) throw TypeError('Supplied replacer not Replacer instance:\n' + replacer.name)

    this._replacers.set(replacer.key, replacer)
  }

  /**
   * Load replacers
   * @param {Replacer[]|Replacer} [replacers=[]] The replacer(s) to load
   */
  loadReplacers (replacers = []) {
    if (Array.isArray(replacers)) {
      for (const replacer of replacers) this._loadReplacer(replacer)
    } else this._loadReplacer(replacers)
  }

  /**
   * Parse the arguments from a message
   * @private
   * @param   {Eris.Guild}                                            guild   The guild the command was initiated in
   * @param   {String}                                                command The command
   * @param   {String}                                                chars   The argument content provided
   * @returns {Array<String|Number|Eris.Channel|Eris.User>|undefined}         The parsed arguments or undefined if the type requirements aren't matched
   */
  _parseArgs (guild, command, chars) {
    const parsed = []

    let startingIndex = 0
    for (let arg = 0; arg < command.options.args.length; arg++) {
      for (let charIndex = startingIndex; charIndex <= chars.length; charIndex++) {
        const potenDelim = chars.substring(charIndex, charIndex + command.options.args[arg].delim.length)

        if ((potenDelim === command.options.args[arg].delim && arg !== command.options.args.length - 1) || charIndex >= chars.length) {
          startingIndex = charIndex + command.options.args[arg].delim.length

          break
        } else if (parsed[arg]) parsed[arg] += chars[charIndex]
        else parsed[arg] = chars[charIndex]
      }

      if (parsed[arg] !== undefined) {
        switch (command.options.args[arg].type) {
          case 'number':
            const number = parseFloat(parsed[arg])

            if (number) parsed[arg] = number
            else return

            break
          case 'user':
          case 'channel': {
            const value = this._parseDynArg(guild, parsed[arg], command.options.args[arg].type)

            if (value) parsed[arg] = value
            else return

            break
          }
        }
      }
    }

    return parsed
  }

  /**
   * Parse a dynamic arg (Either a mention or name)
   * @private
   * @param   {Eris.Guild} guild The guild the target is in
   * @param   {String}     arg   The argument
   * @param   {String}     type  The type of arg (user, channel)
   */
  _parseDynArg (guild, arg, type) {
    const container = type === 'user' ? this._client.users : guild.channels

    const match = arg.match(this._regexes.dynamics[type])

    if (match) return container.get(match[1])
    else return container.find((i) => (type === 'user' ? i.username : i.name).toLowerCase().includes(arg.toLowerCase()))
  }

  /**
   * Check message content for stuff to replace
   * @private
   * @param   {Eris.Guild} guild   The guild the message was sent in
   * @param   {String}     content The message content to run the replacers against
   * @returns {String}             The message content after replacement
   */
  _runReplacers (guild, content) {
    return content.replace(new RegExp(`${this._options.replacerBraces.open.replace(this._regexes.escapables, '\\$&')}(.+?)${this._options.replacerBraces.close.replace(this._regexes.escapables, '\\$&')}`, 'g'), (content, capture) => {
      const keyword = capture.substring(0, capture.includes(' ') ? capture.indexOf(' ') : capture.length).toLowerCase()
      const replacer = this.getReplacer(keyword)

      if (replacer) {
        let args = []

        if (replacer.options.args.length) {
          args = this._parseArgs(guild, replacer, capture.substring(keyword.length + 1))

          if (!args || args.length < replacer.options.args.filter((a) => a.mand).length) return 'INVALID ARGS'
        }

        return replacer.action({ content, capture, args })
      } else return 'INVALID KEY'
    })
  }

  /**
   * Finish environment setup for responses from a command
   * @private
   * @async
   * @param   {Object}                data                   Situational data
   * @prop    {Eris.Message}          data.msg               The message that executed the command
   * @param   {Object}                options                The options for the response
   * @prop    {String}                options.channel        The ID of the channel the response was sent to
   * @prop    {Await[]|Await}         options.awaits         An action or list of actions that are awaited after the results are processed
   * @prop    {ReactInterface}        options.reactInterface A react interface that is bound to the resulting message
   * @prop    {Number}                options.deleteAfter    How long until the response is deleted
   * @param   {Eris.Message|Error}    response               The response that was sent to Discord
   * @returns {Promise<Eris.Message>}                        The response that was utilized
   */
  async _implementResponse ({ msg }, options, response) {
    const {
      channel,
      awaits,
      reactInterface,
      deleteAfter
    } = options

    if (awaits) this.addAwaits(awaits, { _fallBackChannel: channel, _fallBackUser: msg.author.id, _triggerResponse: response })

    if (reactInterface) {
      if (this._agent && this._agent.reactionHandler) await this._agent.reactionHandler.bindInterface(response, reactInterface, msg.author.id)
      else throw Error('The reaction handler isn\'t enabled; enable it by passing an empty array to Agent.handlerData.reactCommands')
    }

    if (deleteAfter) {
      if (!response || response instanceof Error) throw Error('Cannot delete a non-existent response with a delay of:\n' + deleteAfter)

      if (typeof deleteAfter !== 'number') throw TypeError('Supplied deleteAfter delay is not a number:\n' + deleteAfter)

      setTimeout(() => response.delete().catch((ignore) => ignore), deleteAfter)
    }

    return response
  }

  /**
   * Normalize a message's content
   * @private
   * @param   {String}     msg     The subject message
   * @returns {Normalized}         The processed content
   */
  _normalize (msg) {
    const guildPrefix = msg.channel.type ? null : this._options.guildPrefixes[msg.channel.guild.id]
    const prefixRegex = new RegExp(`^(?:<@!?${this._client.user.id}> ?|${(guildPrefix || this._options.prefix).replace(this._regexes.escapables, '\\$&')})(.+?)$`)

    const postReplacers = this._runReplacers(msg.channel.guild, msg.content)
    const match = postReplacers.match(prefixRegex)

    return {
      content: match ? match[1] : postReplacers,
      prefixed: Boolean(match) || msg.channel.type === 1
    }
  }

  /**
   * Set a server's custom prefix
   * @param {String} guild  The ID of the guild
   * @param {String} prefix The custom prefix
   */
  setGuildPrefix (guild, prefix) {
    this._options.guildPrefixes[guild] = prefix
  }
}

module.exports = CommandHandler

/**
 * Result of a handled command
 * @typedef {Object}         CommandHandlerResult
 * @prop    {Object}         CommandHandlerResult.options                Additional options resulting from the command
 * @prop    {String[]}       CommandHandlerResult.options.channels       The IDs of the channels the responses were sent to
 * @prop    {Await[]}        CommandHandlerResult.options.awaits         A list of actions that are awaited after the results are processed
 * @prop    {ReactInterface} CommandHandlerResult.options.reactInterface A react interface that is bound to the resulting message
 * @prop    {Number}         CommandHandlerResult.options.deleteAfter    How long until the response is deleted
 * @prop    {Eris.Message[]} CommandHandlerResult.responses              The resulting responses of the command
 */

/**
 * Object returned by the handle method
 * @typedef {Object}                 CommandHandlerResultList
 * @prop    {Command|Await}          CommandHandlerResultList.command The object of the command called
 * @prop    {CommandHandlerResult[]} CommandHandlerResultList.results The results of every message sent
 */

/**
 * Normalized message content
 * @typedef {Object}  Normalized
 * @prop    {String}  content    The processed content
 * @prop    {Boolean} prefixed   Whether the content was prefixed or not (Bot mention counts) (Always returns true if message channel is DM channel)
 */
