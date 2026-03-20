# WeChat.py
import requests
import urllib.parse
import os
from dotenv import load_dotenv
from logs import log

class WeChat:
    def __init__(self,type):
        load_dotenv()
        self.login_type = type
        log('WeChat-info',f"[WeChat] Initializing with type: {type}")
        if(type == 'rs'):
            self.corp_id = os.getenv("CORP_ID", "ww1923a7aa7cf707e5")
            self.agent_id = os.getenv("AGENT_ID", "1000025")
            self.corp_secret = os.getenv("CORP_SECRET", "EO-N9BRIPxpzQoand4LOE0ZPxrhObnvIA6E2B9q_rO8")
            self.redirect_uri = os.getenv("REDIRECT_URI", "https://ai.wyoooni.net")
        elif(type == 'rc'):
            self.corp_id = os.getenv("CORP_ID_RC", "wwadc402ce6c210978")
            self.agent_id = os.getenv("AGENT_ID_RC", "1000011")
            self.corp_secret = os.getenv("CORP_SECRET_RC", "ZTeSpJTC7BiTdVXRwyq3JkDWBsntJdybvjfmKA6gcbo")
            self.redirect_uri = os.getenv("REDIRECT_URI_RC", "https://ai.wyoooni.net")
        log('WeChat-info',f"[WeChat] Config - corp_id: {self.corp_id}, agent_id: {self.agent_id}, redirect_uri: {self.redirect_uri}")
    
    def get_auth_url(self):
        """获取企业微信授权URL"""
        base_url = "https://open.weixin.qq.com/connect/oauth2/authorize"
        redirect_uri_encoded = urllib.parse.quote(f"{self.redirect_uri}/api/auth/callback")
        auth_url = (
            f"{base_url}?appid={self.corp_id}"
            f"&redirect_uri={redirect_uri_encoded}"
            f"&response_type=code"
            f"&scope=snsapi_base"
            f"&agentid={self.agent_id}"
            "#wechat_redirect"
        )
        log('WeChat-info',f"[WeChat] Generated auth_url for type={self.login_type}: {auth_url}")
        return auth_url
    
    async def get_access_token(self):
        """获取企业微信access_token"""
        url = f"https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid={self.corp_id}&corpsecret={self.corp_secret}"
        log('WeChat-info',f"[WeChat] Requesting access_token for type={self.login_type}, corp_id={self.corp_id}")
        log('WeChat-info',f"[WeChat] access_token URL: {url}")
        try:
            response = requests.get(url)
            log('WeChat-info',f"[WeChat] access_token response status: {response.status_code}")
            data = response.json()
            log('WeChat-info',f"[WeChat] access_token response data: {data}")
            if data.get("errcode") == 0:
                log('WeChat-info',f"[WeChat] Successfully got access_token: {data.get('access_token')[:20]}...")
                return data.get("access_token")
            else:
                log('WeChat-error',f"[WeChat] Failed to get access_token, errcode={data.get('errcode')}, errmsg={data.get('errmsg')}")
                return None
        except Exception as e:
            log('WeChat-error',f"[WeChat] Exception when getting access_token: {str(e)}")
            return None
    
    async def get_user_info(self, access_token: str, code: str):
        """使用access_token和code获取用户信息"""
        log('WeChat-info',f"[WeChat] Getting user_info with code={code}, type={self.login_type}")
        
        # 第一步：通过code获取用户UserID
        userid_url = f"https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?access_token={access_token}&code={code}"
        log('WeChat-info',f"[WeChat] Step1 - getuserinfo URL: {userid_url}")
        try:
            userid_response = requests.get(userid_url)
            log('WeChat-info',f"[WeChat] Step1 - getuserinfo response status: {userid_response.status_code}")
            userid_data = userid_response.json()
            log('WeChat-info',f"[WeChat] Step1 - getuserinfo response data: {userid_data}")
        except Exception as e:
            log('WeChat-error',f"[WeChat] Step1 - Exception when getting userinfo: {str(e)}")
            return None
        
        if userid_data.get("errcode") != 0:
            log('WeChat-error',f"[WeChat] Step1 - Failed to get userinfo, errcode={userid_data.get('errcode')}, errmsg={userid_data.get('errmsg')}")
            return None
        
        userid = userid_data.get("UserId")
        log('WeChat-info',f"[WeChat] Step1 - Got UserId: {userid}")
        
        if not userid:
            log('WeChat-error',f"[WeChat] Step1 - UserId is empty")
            return None
        
        # 第二步：通过UserID获取用户详细信息
        detail_url = f"https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token={access_token}&userid={userid}"
        log('WeChat-info',f"[WeChat] Step2 - Get user detail URL: {detail_url}")
        try:
            detail_response = requests.get(detail_url)
            log('WeChat-info',f"[WeChat] Step2 - Get user detail response status: {detail_response.status_code}")
            detail_data = detail_response.json()
            log('WeChat-info',f"[WeChat] Step2 - Get user detail response data: {detail_data}")
        except Exception as e:
            log('WeChat-error',f"[WeChat] Step2 - Exception when getting user detail: {str(e)}")
            return None
        
        if detail_data.get("errcode") == 0:
            log('WeChat-info',f"[WeChat] Successfully got user detail for userid={userid}, name={detail_data.get('name')}")
            return detail_data
        else:
            log('WeChat-error',f"[WeChat] Step2 - Failed to get user detail, errcode={detail_data.get('errcode')}, errmsg={detail_data.get('errmsg')}")
            return None