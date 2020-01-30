import React, { createContext, Component } from 'react'

const GlobalContext = createContext({})

export default GlobalContext

export const GlobalConsumer = GlobalContext.Consumer

let setProviderInstance
const providerPromise = new Promise(resolve => {
  setProviderInstance = resolve
})

export const getProvider = () => providerPromise

class Provider extends Component {
  state = {
    networkState: {}
  }

  async componentDidMount() {
    setProviderInstance(this)
  }

  setNetworkState = networkState => {
    this.setState({ networkState })
  }

  render() {
    return (
      <GlobalContext.Provider
        value={{
          networkState: this.state.networkState
        }}
      >
        {this.props.children}
      </GlobalContext.Provider>
    )
  }
}

export const GlobalProvider = Provider
