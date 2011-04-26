# -*- coding: utf-8 -*-
require 'appengine-apis/logger'
require 'sinatra'
require 'oauth'
require 'json'
require 'pr_geohash'
require 'vendors/tiny_ds/lib/tiny_ds.rb'

$gae_instance_guid = "GAE"+Time.now.strftime("%Y%m%d%H%M%S")+"-"+java.util.UUID.randomUUID().to_s
PROTOCOL_VERSION = 20110107.0
FIND_SCOPE = 30

# Create your model class
class User < TinyDS::Base
  property :user_id,       :string
  property :screen_name,   :string
  property :user_name,     :string
  property :icon_url,      :string
  
  property :checkedin_at,  :time
  property :locations,     :list
  property :accuracy,      :integer
  property :latitude,      :float
  property :longitude,     :float
  
  property :message,       :text
  
  property :access_token,  :string
  property :access_secret, :string
  
  property :created_at,    :time
  property :updated_at,    :time

  def to_hash
    {
      'account' => self.screen_name,
      'name' => self.user_name,
      'icon' => self.icon_url,
      'message' => self.message || ''
    }
  end
end

post '/checkin' do
  params[:name]
end

get '/test1' do 
  geohash = GeoHash.encode(params[:latitude].to_f, params[:longitude].to_f, 6)
  geohash_and_neighbors = GeoHash.neighbors(geohash) + [geohash]

  User.create({:user_id => params[:user_id],
      :screen_name => params['screen_name']|| "user:#{params['user_id']}",
      :user_name => params['name']|| "user:#{params['user_id']}",
      :icon_url => params['profile_image_url'] || "http://developer.appcelerator.com.s3.amazonaws.com/blog/assets/img/meta-og-image.jpg",  
  
    :latitude => params[:latitude],
    :longitude => params[:longitude],
    :accuracy => params[:accuracy].sub(/\.\d+/,'').to_i || 100,
    :locations => geohash_and_neighbors,
    :checkedin_at => Time.now,
    :message => params[:message]
    }, { :id => params[:user_id].to_i })
  list(nil, params).to_json
end

get '/list' do 
  list(nil, params).to_json
end

def list(current_user, params)
  expired_at = Time.now - 60 * 60
  latitude = params[:latitude].to_f
  longitude = params[:longitude].to_f
  accuracy = params[:accuracy].sub(/\.\d+/,'').to_i
  geohash = GeoHash.encode(latitude, longitude, 6)
  users = User.query.filter(:locations => geohash).filter(:checkedin_at, ">=", expired_at).all.map { |user|
    if current_user && current_user.user_id == user.user_id
      nil
    else
      distance = Math.sqrt(
        ((latitude - user.latitude)*111000)**2 +
        ((longitude - user.longitude)*91000)**2
      )
      if distance < accuracy + user.accuracy + FIND_SCOPE
        user
      else
        nil
      end
    end
  }.compact
  {:people => users.map{|u| u.to_hash}, :version => PROTOCOL_VERSION}
end

def checkin(user, params, user_info=nil)
  # Geohash 7文字で 152m x 123m
  geohash = GeoHash.encode(params[:latitude].to_f, params[:longitude].to_f, 6)
  geohash_and_neighbors = GeoHash.neighbors(geohash) + [geohash]
  
  attrs = {
    :access_token => params[:twitter_access_token],
    :access_secret => params[:twitter_access_secret],

    :latitude => params[:latitude],
    :longitude => params[:longitude],
    :accuracy => params[:accuracy].sub(/\.\d+/,'').to_i,
    :locations => geohash_and_neighbors,
    :checkedin_at => Time.now,
    :message => params[:message]
  }
  if user_info
    attrs.update({
      :user_id => user_info['id_str'],
      :screen_name => user_info['screen_name'],
      :user_name => user_info['name'],
      :icon_url => user_info['profile_image_url']
    })
  end
  
  if user
    user.attributes = attrs
    user.save
  else
    user = User.create(attrs, { :id => user_info['id'] })
  end
  user
end

get '/checkin' do
  user = User.get_by_id(params['twitter_user_id'].to_i)
  if user && user.access_token == params[:twitter_access_token] && user.access_secret == params[:twitter_access_secret]
    checkin(user, params)
    return list(user, params).to_json
  end
  
  consumer = OAuth::Consumer.new(
    'App key',
    'Secret key',
    :site => 'http://api.twitter.com'
  )

  access_token = OAuth::AccessToken.new(
    consumer,
    params[:twitter_access_token],
    params[:twitter_access_secret]
  )

  response = access_token.request(
    :get,
    '/account/verify_credentials.json'
  )
  
  case response
  when Net::HTTPSuccess
    user_info = JSON.parse(response.body)
    return {:error => 'Unknow error'}.to_json unless user_info['screen_name']
    user = checkin(user, params, user_info)
    list(user, params).to_json
    
  when Net::HTTPUnauthorized
    response.body
    
  else
    {:error => 'Unknow error'}.to_json
  end
end
