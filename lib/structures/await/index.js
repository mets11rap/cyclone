const Argument = require('../argument/')

/**
 * A class used for the awaiting of a criteria-matching message
 */
class Await {
  /**
   * Create an Await
   * @class
   * @param {Object}                data                               The await data
   * @prop  {Object}                [data.options={}]                  The options for the await
   * @prop  {Array<ArgData|String>} [data.options.args=[]]             The arguments for the await (Can be an argument data object or just the name of the argument)
   * @prop  {CheckFunction}         [data.options.check=() => true]    The condition to be met for the await to trigger
   * @prop  {Number}                [data.options.timeout=15000]       How long until the await expires
   * @prop  {Boolean}               [data.options.oneTime=false]       Whether a non-triggering message cancels the await
   * @prop  {Boolean}               [data.options.refreshOnUse=false]  Whether the timeout for the await refreshes after a use
   * @prop  {CancelFunction}        [data.options.onCancelFunction]    A function to run once the await expires or is cancelled
   * @prop  {String}                [data.options.user]                The ID of the user to await the message from (By default, it's the user who triggered the command)
   * @prop  {String}                [data.options.channel]             The ID of the channel to await the message (By default, it's the channel the command was called in)
   * @prop  {Boolean}               [data.options.shouldShift=false]   Whether the command handler should shift out the first space-separated keyword for argument parsing or not
   * @prop  {Boolean}               [data.options.requirePrefix=false] Whether the await requires the bot prefix to be triggered
   * @prop  {AwaitAction}           data.action                        The await action
   */
  constructor ({ options = {}, action }) {
    const {
      args = [],
      check = () => true,
      timeout = 15000,
      oneTime = false,
      refreshOnUse = false,
      onCancelFunction,
      user,
      channel,
      shouldShift = false,
      requirePrefix = false
    } = options

    /**
     * The options for the await
     * @type {Object}
     * @prop {Argument[]}     args             The arguments for the await
     * @prop {CheckFunction}  check            The condition to be met for the await to trigger
     * @prop {Number}         timeout          How long until the await expires
     * @prop {Boolean}        oneTime          Whether a non-triggering message cancels the await
     * @prop {Boolean}        refreshOnUse     Whether the timeout for the await refreshes after a use
     * @prop {CancelFunction} onCancelFunction A function to run once the await expires or is cancelled
     * @prop {String}         user             The ID of the user to await the message from (By default, it's the user who triggered the command)
     * @prop {String}         channel          The channel to await the message (By default, it's the channel the command was called in)
     * @prop {Boolean}        shouldShift      Whether the command handler should shift out the first space-separated keyword for argument parsing or not
     * @prop {Boolean}        requirePrefix    Whether the await requires the bot prefix to be triggered
     */
    this.options = {
      args: args.map((arg) => new Argument(arg)),
      check,
      timeout,
      oneTime,
      refreshOnUse,
      onCancelFunction,
      user,
      channel,
      shouldShift,
      requirePrefix
    }

    /**
     * The await action
     * @type {AwaitAction}
     */
    this.action = action
  }

  /**
   * Clear the await from its storage
   * @returns {Await} The await that was cleared
   */
  clear () {
    if (!this._timer) throw Error('You have not started the timer yet!')

    clearTimeout(this._timer)

    this._awaitMap.delete(this._id)

    if (this.options.onCancelFunction) this.options.onCancelFunction(this)

    return this
  }

  /**
   * Refresh the delete timer for the await
   * @returns {Await} The await
   */
  refresh () {
    if (!this._timer) throw Error('You have not started the timer yet!')

    clearTimeout(this._timer)

    /**
     * The delete timer for the await
     * @private
     * @type    {Timeout}
     */
    this._timer = setTimeout(this.clear, this.options.timeout)

    return this
  }

  /**
   * Start the delete timer for the await
   * @param   {Object}             data                 Further await data
   * @prop    {String}             data.id              The ID of the await in its parent map
   * @prop    {Map<String, Await>} data.awaitMap        The map that the await is stored in
   * @prop    {Eris.Message}       data.triggerResponse The response to the command that initiated the await
   * @returns {Await}                                   The await
   */
  startTimer ({ id, awaitMap, triggerResponse }) {
    /**
     * The ID of the await.
     * @private
     * @type    {String}
     */
    this._id = id

    /**
     * The map that the await is stored in
     * @private
     * @type    {Map<String, Await>}
     */
    this._awaitMap = awaitMap

    /**
     * The response to the command that initiated the await
     * @type {Eris.Message}
     */
    this.triggerResponse = triggerResponse

    /**
     * The delete timer for the await
     * @private
     * @type    {Timeout}
     */
    this._timer = setTimeout(() => this.clear(), this.options.timeout)

    return this
  }
}

module.exports = Await

/**
 * The condition to be met for the await to trigger
 * @callback                CheckFunction
 * @param    {Eris.Message} msg           The message object, but if a prefix is required, the message content will not include the prefix
 * @param    {String}       content       The message content (processed by command handler (DO NOT USE `msg.content`))
 * @returns  {Boolean}                    Whether the message meets the await requirements
 */

/**
 * The code that runs once an await is cancelled
 * @callback         CancelFunction
 * @param    {Await} wait           The await
 */

/**
 * The await action.
 * @callback                                                   AwaitAction
 * @param    {AwaitData}                                       data        Data passed from the handler
 * @returns  {CommandResults[]|CommandResults|String[]|String}             Data to respond with
 */

/**
 * The object passed to a command action
 * @typedef {Object}                AwaitData
 * @prop    {Agent}                 AwaitData.agent           The agent managing the bot
 * @prop    {Eris.Client}           AwaitData.client          The Eris client
 * @prop    {Map<String, Command>}  AwaitData.commands        The list of bot commands
 * @prop    {Map<String, Replacer>} AwaitData.replacers       The list of bot replacers
 * @prop    {Eris.Message}          AwaitData.msg             The message sent by the user
 * @prop    {String[]}              AwaitData.args            The arguments supplied by the user
 * @prop    {Object}                AwaitData.attachments     User-supplied data that is passed to commands
 * @prop    {Eris.Message}          AwaitData.triggerResponse The bot's response to the message that initiated the await
 */
