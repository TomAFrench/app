import React, { useState } from 'react'

import SafeMutation from '../SafeMutation'
import Tooltip from '../Tooltip'
import WarningBox from '../WarningBox'
import Button from '../Forms/Button'
import {
  CREATE_LOGIN_CHALLENGE,
  SIGN_CHALLENGE_STRING
} from '../../graphql/mutations'
import { useAuthContext } from '../../contexts/AuthContext'

const RefreshAuthTokenButton = props => {
  const [error, setError] = useState(null)
  const [
    ,
    { reloadUserAddress, setAuthTokenFromSignature, setUserProfile }
  ] = useAuthContext()

  const { onClick, title } = props

  const buildCallback = ({
    showTooltip,
    hideTooltip,
    createLoginChallenge,
    signChallengeString
  }) => async ({ fetchUserProfileFromServer }) => {
    try {
      setError(null)

      const address = await reloadUserAddress()
      if (!address) {
        throw new Error('Unable to obtain user ethereum address')
      }

      const result1 = await createLoginChallenge({
        variables: { address }
      })

      if (result1.errors) {
        throw new Error('Failed to obtain login challenge!')
      }

      showTooltip()

      const {
        challenge: { str }
      } = result1.data

      const result2 = await signChallengeString({
        variables: {
          challengeString: str
        }
      })

      hideTooltip()

      if (result2.errors) {
        throw new Error('Failed to obtain signature!')
      }

      const { signature } = result2.data

      await setAuthTokenFromSignature(address, signature)

      const result3 = await fetchUserProfileFromServer()

      if (result3.errors) {
        throw new Error('Failed to fetch user profile!')
      }

      const { profile } = result3.data

      setUserProfile(profile)
    } catch (error) {
      hideTooltip()
      setError(error)
      throw error
    }
  }

  return (
    <SafeMutation mutation={CREATE_LOGIN_CHALLENGE}>
      {createLoginChallenge => (
        <SafeMutation mutation={SIGN_CHALLENGE_STRING}>
          {signChallengeString => (
            <>
              <Tooltip text="Please sign the login message using your wallet or Dapp browser">
                {({ showTooltip, hideTooltip, tooltipElement }) => (
                  <Button
                    data-testid="sign-in-button"
                    analyticsId="Sign Message"
                    onClick={() =>
                      onClick(
                        buildCallback({
                          showTooltip,
                          hideTooltip,
                          createLoginChallenge,
                          signChallengeString
                        })
                      )
                    }
                  >
                    {title || 'Sign in'}
                    {tooltipElement}
                  </Button>
                )}
              </Tooltip>
              {error ? <WarningBox>{`${error}`}</WarningBox> : null}
            </>
          )}
        </SafeMutation>
      )}
    </SafeMutation>
  )
}

export default RefreshAuthTokenButton
