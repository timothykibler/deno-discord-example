async function getGateway() {

  const response = await fetch(`${API_ENDPOINT}/gateway/bot`, {
    headers: {
      'Authorization': `Bot ${BOT_TOKEN}`
    }
  }).catch(e => {
    throw e
  })

  return await response.json()
}

module.exports = {
  getGateway
}
