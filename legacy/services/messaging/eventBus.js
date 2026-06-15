// services/messaging/eventBus.js
import amqplib from 'amqplib'

const EXCHANGE = 'taskfinder.events'
let channel = null

export async function connect() {
  const connection = await amqplib.connect(process.env.RABBITMQ_URL)
  channel = await connection.createChannel()
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true })
  console.log('[eventBus] Connected to RabbitMQ')
  connection.on('close', () => { console.warn('[eventBus] Reconnecting...'); setTimeout(connect, 5000) })
  return channel
}

export function publish(routingKey, payload) {
  if (!channel) throw new Error('Event bus not connected.')
  channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true })
  console.log(`[eventBus] Published: ${routingKey}`)
}

export async function subscribe(routingPattern, queueName, handler) {
  if (!channel) throw new Error('Event bus not connected.')
  await channel.assertQueue(queueName, { durable: true })
  await channel.bindQueue(queueName, EXCHANGE, routingPattern)
  channel.prefetch(1)
  channel.consume(queueName, async (msg) => {
    if (!msg) return
    try {
      const payload = JSON.parse(msg.content.toString())
      await handler(payload)
      channel.ack(msg)
    } catch (err) {
      console.error(`[eventBus] Handler error on ${routingPattern}:`, err.message)
      channel.nack(msg, false, true)
    }
  })
  console.log(`[eventBus] Subscribed: ${routingPattern} -> ${queueName}`)
}