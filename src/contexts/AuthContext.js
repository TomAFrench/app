import React, {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  useEffect
} from 'react'
import _ from 'lodash'
import { withApollo } from 'react-apollo'
import jwt from 'jsonwebtoken'

import { identify as logRocketIdentify } from '../api/logRocket'
import * as LocalStorage from '../api/localStorage'
import { getAccount } from '.././api/web3'
import { SIGN_IN } from '../modals'
import { LOGIN_USER_NO_AUTH } from '../graphql/mutations'
import { buildAuthHeaders } from '../utils/requests'

import { useModalContext } from './ModalContext'

const SET_ADDRESS = 'SET_ADDRESS'
const SET_PROFILE = 'SET_PROFILE'
const SET_AUTH_TOKEN = 'SET_AUTH_TOKEN'
const SET_LOGGED_OUT = 'SET_LOGGED_OUT'

const AUTH = 'auth'
const TOKEN_SECRET = 'kickback'
const TOKEN_ALGORITHM = 'HS256'

const INITIAL_AUTH_STATE = LocalStorage.getItem(AUTH) || {}

export const AuthContext = createContext()

export function useAuthContext() {
  return useContext(AuthContext)
}

// Hacky method to make state accessible to graphql/auth.js
// Is updated below
let authState = INITIAL_AUTH_STATE
export const getProvider = () => authState

function reducer(state, { type, payload }) {
  switch (type) {
    case SET_ADDRESS: {
      const { address } = payload
      return {
        ...state,
        address
      }
    }
    case SET_PROFILE: {
      const { profile } = payload
      return {
        ...state,
        profile,
        // need this on both this and SET_AUTH_TOKEN since they can be called independently of each other
        loggedIn: true
      }
    }
    case SET_AUTH_TOKEN: {
      const { token } = payload
      return {
        ...state,
        token,
        // need this on both this and SET_PROFILE since they can be called independently of each other
        loggedIn: true
      }
    }
    case SET_LOGGED_OUT: {
      return {
        ...state,
        token: undefined,
        profile: null,
        loggedIn: false
      }
    }
    default: {
      throw Error(`Unexpected action type in AuthContext reducer: '${type}'.`)
    }
  }
}

export default withApollo(function Provider({ client, children }) {
  const [, { showModal }] = useModalContext()

  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_AUTH_STATE,
    apolloClient: client
  })

  useEffect(() => {
    // try and sign in!
    signIn({ dontForceSignIn: true })
  }, [])

  const setAddress = useCallback(address => {
    dispatch({ type: SET_ADDRESS, payload: { address } })
  }, [])

  const reloadUserAddress = async () => {
    const address = await getAccount()
    setAddress(address)
    return address
  }

  const setUserProfile = useCallback(profile => {
    console.log('Current user', profile)

    logRocketIdentify(profile)
    dispatch({ type: SET_PROFILE, payload: { profile } })
  }, [])

  const setAuthTokenFromSignature = (address, sig) => {
    const token = jwt.sign({ address, sig }, TOKEN_SECRET, {
      algorithm: TOKEN_ALGORITHM
    })

    console.log(`New auth token: ${token}`)

    // save to local storage for next time!
    LocalStorage.setItem(AUTH, { token })

    dispatch({ type: SET_AUTH_TOKEN, payload: { token } })
  }

  const signIn = async ({ dontForceSignIn } = {}) => {
    const { loggedIn, token, apolloClient } = state

    if (loggedIn) {
      return
    }

    // let's request user's account address
    const address = await reloadUserAddress()
    if (!address) {
      return
    }

    console.debug(`Checking if user ${address} is logged in ...`)

    try {
      const payload = jwt.verify(token, TOKEN_SECRET, {
        algorithm: TOKEN_ALGORITHM
      })
      if (_.get(payload, 'address', '') !== address) {
        throw new Error('Token not valid for current user address')
      }

      const {
        data: { profile }
      } = await apolloClient.mutate({
        mutation: LOGIN_USER_NO_AUTH,
        context: {
          headers: buildAuthHeaders(token)
        }
      })

      console.debug(`User ${address} is logged in and has a profile`)

      setUserProfile(profile)
    } catch (err) {
      console.debug(
        `User ${address} is not logged and/or does not have a profile`
      )
      setLoggedOut()

      if (!dontForceSignIn) {
        showModal({ name: SIGN_IN })
      }
    }
  }

  const setLoggedOut = useCallback(() => {
    dispatch({ type: SET_LOGGED_OUT })
  }, [])

  authState = useMemo(
    () => [
      state,
      {
        setAddress,
        reloadUserAddress,
        setUserProfile,
        setAuthTokenFromSignature,
        setLoggedOut,
        signIn
      }
    ],
    [
      state,
      setAddress,
      reloadUserAddress,
      setUserProfile,
      setAuthTokenFromSignature,
      setLoggedOut,
      signIn
    ]
  )

  return (
    <AuthContext.Provider
      value={useMemo(
        () => [
          state,
          {
            setAddress,
            reloadUserAddress,
            setUserProfile,
            setAuthTokenFromSignature,
            setLoggedOut,
            signIn
          }
        ],
        [
          state,
          setAddress,
          reloadUserAddress,
          setUserProfile,
          setAuthTokenFromSignature,
          setLoggedOut,
          signIn
        ]
      )}
    >
      {children}
    </AuthContext.Provider>
  )
})

export function setUserProfile(profile) {
  const [, { setUserProfile }] = useAuthContext()
  setUserProfile(profile)
}

export function useAuthToken() {
  const [{ token }] = useAuthContext()
  return token
}

export function useIsLoggedIn() {
  const [{ loggedIn }] = useAuthContext()
  return loggedIn
}

export function useUserAddress() {
  const [{ address }] = useAuthContext()
  return address
}

export function useUserProfile() {
  const [{ profile }] = useAuthContext()
  return profile
}
