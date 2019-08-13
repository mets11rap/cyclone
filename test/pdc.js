const Collection = require('eris').Collection
const EventEmitter = require('events').EventEmitter

/**
 * A fake Eris Discord client to simulate a connected bot.
 */
class PseudoClient extends EventEmitter {
  /**
   * Create a client.
   * @class
   * @param {String}            [token='1234'] The bot token.
   * @param {PseudoClient.User} [owner]        The bot owner.
   */
  constructor (token = '1234', owner = new User({ id: '1', username: 'owner' })) {
    super()

    /**
     * The bot token.
     * @type {String}
     */
    this.token = 'Bot ' + token

    /**
     * The bot owner.
     * @private
     * @type    {PseudoClient.User}
     */
    this._owner = owner

    /**
     * The client user.
     * @type {PseudoClient.User}
     */
    this.user = new User({ id: '0', username: 'client' }, this)
    this.user.bot = true

    /**
     * The client shards.
     * @type {Collection<String, PseudoClient.Shard>}
     */
    this.shards = new Collection()

    this._addShard(this)

    /**
     * The guilds the user is in.
     * @type {Collection<String, PseudoClient.Guild>}
     */
    this.guilds = new Collection()

    /**
     * The users the bot has cached.
     * @type {Collection<String, PseudoClient.User>}
     */
    this.users = new Collection()
    this.users.set(this.user.id, this.user)

    /**
     * An object mapping channel IDs to guild IDs.
     * @type {Object}
     */
    this.channelGuildMap = {}
  }

  /**
   * Set whether the connect method should succeed or fail.
   * @private
   * @param {Boolean} status The status of the connect method.
   */
  _setConnectStatus (status) {
    this._connectStatus = status
  }

  /**
   * Simulate connecting to the Discord API.
   */
  async connect () {
    if (!this._connectStatus) throw Error()

    this.emit('ready')
    this.emit('shardReady', this.shards.get(0).id)
  }

  /**
   * Add a shard to the client.
   * @private
   * @param   {PseudoClient} client The client that's being sharded.
   */
  _addShard (client) {
    this.shards.set(this.shards.size, new Shard({ id: this.shards.size, client }))
  }

  /**
   * Add a user to the cache.
   * @private
   * @param   {Object}            userData The user data to add.
   * @return  {PseudoClient.User}          The added user.
   */
  _addUser (userData) {
    const user = new User(userData)

    this.users.set(user.id, user)

    return user
  }

  /**
   * Simulate joining a guild.
   * @private
   * @param   {Object}   [data={}]                     The data for the guild object.
   * @prop    {Object}   [data.guildData={}]           The data of the guild.
   * @prop    {String}   [data.guildData.id]           The ID of the guild
   * @prop    {String}   [data.guildData.name='guild'] The name of the guild.
   * @prop    {Object[]} [data.channels=[]]            The guild channels (Objects containing channel data).
   */
  _joinGuild ({ guildData = {}, channels = [] } = {}) {
    const {
      id = String(Date.now()),
      name = 'guild'
    } = guildData

    const guild = new Guild({ id, name, channels }, this.shards.get(0))

    this.guilds.set(id, guild)

    return guild
  }

  /**
   * Create a message in the designated channel.
   * @async
   * @param   {String}                        channel     The channel ID.
   * @param   {Object}                        msg         The message data.
   * @prop    {String}                        msg.content The message content.
   * @prop    {Object}                        msg.embed   The embed to attach
   * @param   {Object}                        file        The file to attach to the message.
   * @prop    {String}                        file.name   The name of the file
   * @prop    {Buffer}                        file.file   The file content.
   * @returns {Promise<PseudoClient.Message>}             The resulting message.
   */
  async createMessage (channel, msg, file) {
    const target = this.guilds.find((g) => g.channels.has(channel))

    if (!target) throw Error('Could not find channel.')

    return target.channels.get(channel).createMessage(msg, file)
  }

  /**
   * Return fake OAuth application data.
   */
  async getOAuthApplication () {
    return {
      owner: this._owner
    }
  }
}

/**
 * A class representing an Eris user.
 */
class User {
  /**
   * Construct a user.
   * @class
   * @param {Object}       [data={}]              The data for the User object.
   * @prop  {String}       [data.id]              The ID of the user.
   * @prop  {String}       [data.username='user'] The username of the user.
   */
  constructor ({ id = String(Date.now()), username = 'user' } = {}) {
    /**
     * The ID of the user.
     * @type {String}
     */
    this.id = id

    /**
     * The username of the user.
     * @type {String}
     */
    this.username = username
  }

  dynamicAvatarURL () {
    return `https://cdn.discordapp.com/avatars/${this.id}/0.jpg?size=undefined`
  }
}

/**
 * A class representing an Eris shard.
 */
class Shard {
  /**
   * Construct a shard.
   * @class
   * @param {Object}       [data={}]   The data for the Shard object.
   * @prop  {String}       data.id     The shard ID.
   * @prop  {PseudoClient} data.client The client to shard.
   */
  constructor ({ id, client }) {
    /**
     * The shard ID
     * @type {String}
     */
    this.id = id

    /**
     * The shard client.
     * @type {PseudoClient}
     */
    this.client = client
  }

  async editStatus () {

  }
}

/**
 * A class representing an Eris guild.
 */
class Guild {
  /**
   * Construct a guild.
   * @class
   * @param {Object}       [data={}]           The data for the guild object.
   * @prop  {String}       [data.id]           The ID of the guild.
   * @prop  {String}       [data.name='guild'] The name of the guild.
   * @prop  {Object[]}     [data.channels=[]]  The channels of the guild (Objects containing channel information).
   * @prop  {PseudoClient} shard               The shard.
   */
  constructor ({ id = String(Date.now()), name = 'guild', channels = [] } = {}, shard) {
    /**
     * The ID of the guild.
     * @type {String}
     */
    this.id = id

    /**
     * The name of the guild.
     * @type {String}
     */
    this.name = name

    /**
     * The channels of the guild.
     * @type {PseudoClient.Collection<String, PseudoClient.Channel>}
     */
    this.channels = new Collection()

    /**
     * The shard.
     * @type {PseudoClient.Shard}
     */
    this.shard = shard

    for (const channel of channels) {
      const {
        id,
        name
      } = channel

      this._createChannel({ id, name })
    }
  }

  /**
   * Create a channel for the guild.
   * @param   {Object}               data                  The data for the channel.
   * @prop    {String}               [data.id]             The ID of the channel.
   * @prop    {String}               [data.name='channel'] The name of the channel.
   * @prop    {PseudoClient.Guild}   data.guild            The parent guild of the channel.
   * @returns {PseudoClient.Channel}                       The created channel.
   */
  _createChannel ({ id = String(Date.now()), name = 'channel' } = {}) {
    const channel = new Channel({ id, name, guild: this })

    this.channels.set(id, channel)

    this.shard.client.channelGuildMap[id] = this.id

    return channel
  }
}

/**
 * A class representing an Eris channel.
 */
class Channel {
  /**
   * Construct a channel.
   * @class
   * @param {Object}             [data={}]             The data for the channel object.
   * @prop  {String}             [data.id]         The ID of the channel.
   * @prop  {String}             [data.name='channel'] The name of the channel.
   * @prop  {PseudoClient.Guild} data.guild            The parent guild of the channel.
   */
  constructor ({ id = String(Date.now()), name = 'channel', guild } = {}) {
    /**
     * The ID of the channel.
     * @type {String}
     */
    this.id = id

    /**
     * The name of the channel.
     * @type {String}
     */
    this.name = name

    /**
     * The parent guild of the channel.
     * @type {PseudoClient.Guild}
     */
    this.guild = guild

    /**
     * The messages of the channel.
     * @type {PseudoClient.Message}
     */
    this.messages = new PseudoClient.Collection()

    /**
     * The type of channel.
     * @type {Number}
     */
    this.type = 0

    /**
     * The permissions of the users.
     * @private
     * @type    {Object}
     */
    this._permissions = {}
  }

  /**
   * Create a message in the channel.
   * @async
   * @param   {String|Object}                 msg         The message content or data.
   * @prop    {String}                        msg.content The message content.
   * @prop    {Object}                        msg.embed   The embed to attach
   * @param   {Object}                        file        The file to attach to the message.
   * @prop    {String}                        file.name   The name of the file
   * @prop    {Buffer}                        file.file   The file content.
   * @returns {Promise<PseudoClient.Message>}             The resulting message.
   */
  async createMessage (msg, file) {
    if (this._createMessageThrow) throw Error('This is purposefully thrown')

    if (this.type) {
      const err = new Error()
      err.name = 'DiscordRESTError [50008]'
      err.message = 'Cannot send messages in a non-text channel'
      err.code = 50008

      throw err
    }

    let tooLong
    let index

    if (msg.embed && msg.embed.fields) {
      for (let i = 0; i < msg.embed.fields.length; i++) {
        if (!msg.embed.fields[i].name) {
          tooLong = 'name'
          index = i
          break
        }
        if (msg.embed.fields[i].value.length > 1024) {
          tooLong = 'embed'
          index = i
          break
        }
      }
    }

    if (msg.content && msg.content.length > 2000) tooLong = 'content'

    if (tooLong || (msg.embed && !msg.embed.name)) {
      const err = Error()
      err.code = 50035
      err.name = 'DiscordRESTError [50035]'
      if (tooLong === 'embed') err.message = `Invalid Form Body\n  embed.fields.${index}.value: Must be 1024 or fewer in length.`
      else if (tooLong === 'name') err.message = `Invalid Form Body\n  embed.fields.${index}.name: This field is required`
      else err.message = 'Invalid Form Body\n  content: Must be 2000 or fewer in length.'

      throw err
    }

    const message = new Message(this, msg, file, this.guild.shard.client.user)

    this.messages.set(message.id, message)

    return message
  }

  /**
   * Get the permissions of a user.
   * @param   {String} user The ID of the user.
   * @returns {Object}      The permissions of the user which has() can be executed on.
   */
  permissionsOf (user) {
    return {
      has: (permission) => {
        const userPerms = this._permissions[user]

        if (userPerms) {
          const perm = userPerms.find((p) => p._name === permission)

          if (perm && perm._allow) return true
        }
      }
    }
  }

  /**
   * Set the permission of a user.
   * @private
   * @param   {String}  user          The ID of the user.
   * @param   {String}  permission    The name of the permission.
   * @param   {Boolean} [value=false] Whether the permission is allowed or not.
   */
  _setPermission (user, permission, value) {
    if (!this._permissions[user]) this._permissions[user] = []

    this._permissions[user].splice(this._permissions[user].findIndex((p) => p._name === permission), 1, {
      _name: permission,
      _allow: value
    })
  }
}

/**
 * A class representing an Eris message.
 */
class Message {
  /**
   * Construct a message.
   * @class
   * @param {PseudoClient.Channel} channel     The channel the message is in.
   * @param {String|Object}        msg         The message data or content.
   * @prop  {String}               msg.content The message content.
   * @prop  {Object}               msg.embed   The embed to attach
   * @param {Object}               file        The file to attach to the message.
   * @prop  {String}               file.name   The name of the file
   * @prop  {Buffer}               file.file   The file content.
   * @param {PseudoClient.User}    _author      The author of the message.
   */
  constructor (channel, msg, file, _author) {
    if (typeof msg === 'string') msg = { content: msg }
    const {
      content,
      embed
    } = msg

    /**
     * The ID of the message.
     * @type {String}
     */
    this.id = String(Date.now())

    /**
     * The channel the message is in.
     * @type {PseudoClient.Channel}
     */
    this.channel = channel

    /**
     * The author of the message.
     * @type {PseudoClient.User}
     */
    this.author = _author

    /**
     * The content of the message.
     * @type {String}
     */
    this.content = content

    /**
     * The embeds of the message.
     * @type {Object[]}
     */
    this.embeds = embed ? [embed] : []

    /**
     * The attachments of the message.
     * @type {Object[]}
     */
    this.attachments = file ? [{
      filename: file.name,
      url: `https://cdn.discordapp.com/attachments/${channel.guild.id}/${channel.id}/${file.name}`
    }] : []

    /**
     * The buffer of the file provided.
     * @private
     * @type    {Buffer}
     */
    if (file) this._attachmentFile = file.file

    /**
     * The reactions on the message.
     * @type {Object}
     */
    this.reactions = {}
  }

  /**
   * Delete the message.
   * @async
   */
  async delete () {
    this.channel.messages.delete(this.id)
  }

  /**
   * React to the message with an emoji.
   * @async
   * @param   {String}            reaction The emoji.
   * @param   {PseudoClient.User} user     The user.
   * @returns {Object}                     The reaction data.
   */
  async addReaction (reaction, user = new User()) {
    if (this.reactions[reaction]) {
      this.reactions[reaction].count++
      this.reactions[reaction].me = true
    } else {
      this.reactions[reaction] = {
        count: 1,
        me: true
      }
    }

    return {
      name: reaction
    }
  }

  /**
   * Remove a reaction on the message.
   * @async
   * @param {String} reaction The emoji to remove.
   */
  async removeReaction (reaction) {
    if (this._removeReactionError) throw Error()

    if (this.reactions[reaction] && this.reactions[reaction].me) {
      if (this.reactions[reaction].count === 1) delete this.reactions[reaction]
      else {
        this.reactions[reaction].count--
        this.reactions[reaction].me = false
      }
    }
  }
}

PseudoClient.Collection = Collection
PseudoClient.User = User
PseudoClient.Shard = Shard
PseudoClient.Guild = Guild
PseudoClient.Channel = Channel
PseudoClient.Message = Message

module.exports = PseudoClient