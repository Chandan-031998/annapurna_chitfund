import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../redux/store'

export function useAuth() {
  const auth = useSelector((state: RootState) => state.auth)
  const dispatch = useDispatch<AppDispatch>()
  return { ...auth, dispatch }
}
